import { StorageManager } from '../common/storage/storage.manager';
import { Bookmark } from '../common/models/bookmark.model';
import { Settings } from '../common/models/settings.model';
import { MESSAGE_ACTIONS } from '../common/models/messages';
import { formatSecondsToTimeString, formatSecondsToTwitchTimestamp } from '../common/utils/time';
import { validateVideoUrl, sanitizeString } from '../common/utils/security';
import { parseVodIdInput, buildVodUrl, buildJumpUrl } from '../common/utils/vod';
import { getChannelLoginFromUrl } from '../common/utils/channel';

/**
 * ポップアップUIの各種イベントハンドリングおよび描画を制御するモジュール
 * 無限スクロール、および別タブ/打刻による変更のリアルタイム同期に対応しています。
 */

const storageManager = StorageManager.getInstance();
let currentSettings: Settings | null = null;
let allBookmarks: Bookmark[] = []; // 全ブックマークのメモリ内キャッシュ
let filteredBookmarks: Bookmark[] = []; // フィルター適用後のブックマークキャッシュ
let activeFilter: 'current' | 'all' = 'current';
let activeTabUrl: string | null = null;
let activeTabTitle: string | null = null;
let activeTabChannel: string | null = null;
let activeTabChannelLogin: string | null = null;
let activeTabIsLive: boolean = false;
const PAGE_SIZE = 50;

let activeTooltip: HTMLDivElement | null = null;

function showTooltip(target: HTMLElement, text: string): void {
  if (activeTooltip) {
    activeTooltip.remove();
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = text;
  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  let left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
  let top = targetRect.top - tooltipRect.height - 8;

  const margin = 8;
  const maxLeft = document.body.clientWidth - tooltipRect.width - margin;
  if (left < margin) {
    left = margin;
  } else if (left > maxLeft) {
    left = maxLeft;
  }

  if (top < margin) {
    top = targetRect.bottom + 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  requestAnimationFrame(() => {
    tooltip.classList.add('visible');
  });
}

function hideTooltip(): void {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
}

function bindTooltip(element: HTMLElement, getTooltipText: () => string): void {
  element.addEventListener('mouseenter', () => {
    showTooltip(element, getTooltipText());
  });
  element.addEventListener('mouseleave', () => {
    hideTooltip();
  });
  element.addEventListener('click', () => {
    hideTooltip();
  });
}

/**
 * URLからクエリやハッシュを除去したベースURLを取得する
 */
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch (e) {
    return url;
  }
}

/**
 * ブックマークが現在のアクティブタブと同一チャンネルかどうかを判定する
 * チャンネルログイン名（URL由来の配信者ID）を優先して比較し、
 * 旧データにはvideoUrlからの導出やチャンネル名の大文字小文字を無視した比較でフォールバックする
 */
function isSameChannelAsActiveTab(bookmark: Bookmark): boolean {
  if (activeTabChannelLogin) {
    if (bookmark.channelLogin) {
      return bookmark.channelLogin === activeTabChannelLogin;
    }
    // 旧データ互換: videoUrlがチャンネルURL形式ならログイン名を導出して比較
    const loginFromUrl = getChannelLoginFromUrl(bookmark.videoUrl);
    if (loginFromUrl) {
      return loginFromUrl === activeTabChannelLogin;
    }
  }
  // 最終フォールバック: チャンネル名の大文字小文字を無視した比較
  if (activeTabChannel) {
    return bookmark.channelName.toLowerCase() === activeTabChannel.toLowerCase();
  }
  return false;
}

/**
 * 安全なURL遷移処理
 */
function navigateToBookmark(bookmark: Bookmark): void {
  const targetUrl = buildJumpUrl(bookmark.videoUrl, bookmark.relativeTime);

  if (validateVideoUrl(targetUrl)) {
    chrome.tabs.create({ url: targetUrl });
  } else {
    console.error('Blocked unsafe URL transition:', targetUrl);
    alert('安全ではないURLへの遷移がブロックされました。');
  }
}

/**
 * 履歴リストの描画処理（DocumentFragment による高速描画 ＆ 無限スクロール対応）
 * @param bookmarks 対象のブックマーク配列
 * @param append true の場合は末尾に追加描画、false の場合は全体をリセットして描画
 */
function renderBookmarkList(bookmarks: Bookmark[], append = false): void {
  const listElement = document.getElementById('bookmark-list');
  const emptyElement = document.getElementById('no-bookmarks');
  if (!listElement || !emptyElement) return;

  if (!append) {
    listElement.innerHTML = '';
  }

  // 1. 全ブックマークをメモリに保持
  allBookmarks = [...bookmarks];

  // 2. フィルター適用
  let targetList = [...allBookmarks];
  if (activeFilter === 'current') {
    const currentBase = activeTabUrl ? getBaseUrl(activeTabUrl) : null;
    if (activeTabIsLive && (activeTabChannelLogin || activeTabChannel)) {
      // ライブ配信中の場合：同一配信のVOD URL一致、または同一チャンネルのライブ打刻を表示
      // (タイトルやチャンネル表示名は取得タイミングで揺れるため比較に使わない)
      targetList = targetList.filter((b) => {
        if (currentBase && getBaseUrl(b.videoUrl) === currentBase) {
          return true;
        }
        return b.isLive && isSameChannelAsActiveTab(b);
      });
    } else if (currentBase) {
      // VOD（アーカイブ動画）の場合：動画ID（ベースURL）が一致するブックマークのみを表示
      // ライブ中に打刻されたもの (isLive=true) も同一VODなら表示対象に含める
      targetList = targetList.filter((b) => getBaseUrl(b.videoUrl) === currentBase);
    }
  }

  // 3. 最新順にソートしてキャッシュ
  filteredBookmarks = targetList.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  if (filteredBookmarks.length === 0) {
    if (!append) {
      emptyElement.textContent =
        activeFilter === 'current'
          ? 'この動画のブックマーク履歴はありません。'
          : 'ブックマークがありません。 Alt+B またはチャットで打刻してください。';
      emptyElement.classList.remove('hidden');
    }
    return;
  }

  emptyElement.classList.add('hidden');

  // スライス範囲の決定
  const start = append ? listElement.children.length : 0;
  const end = Math.min(start + PAGE_SIZE, filteredBookmarks.length);
  const displayList = filteredBookmarks.slice(start, end);

  if (displayList.length === 0) return;

  const fragment = document.createDocumentFragment();

  displayList.forEach((bookmark) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.dataset.id = bookmark.id;

    // 1. ブックマーク情報リンクエリア
    const link = document.createElement('a');
    link.className = 'bookmark-link';
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      navigateToBookmark(bookmark);
    };

    const infoDiv = document.createElement('div');
    infoDiv.className = 'bookmark-info';

    // メタ情報
    const metaDiv = document.createElement('div');
    metaDiv.className = 'bookmark-meta';

    const channelSpan = document.createElement('span');
    channelSpan.className = 'channel-name';
    channelSpan.textContent = bookmark.channelName;
    metaDiv.appendChild(channelSpan);

    if (bookmark.isLive) {
      const liveBadge = document.createElement('span');
      liveBadge.className = 'live-badge';
      liveBadge.textContent = 'LIVE';
      metaDiv.appendChild(liveBadge);
    }

    // VOD ID未設定（チャンネルURLのまま）の場合、アーカイブへ飛べない旨の警告を表示
    const hasVodUrl = bookmark.videoUrl.includes('/videos/');
    if (!hasVodUrl) {
      const warningSpan = document.createElement('span');
      warningSpan.className = 'vod-warning';
      warningSpan.textContent = '⚠';
      bindTooltip(
        warningSpan,
        () =>
          '動画アーカイブURLを取得できませんでした。編集アイコンをクリックし、手動でURLを設定してください。',
      );
      metaDiv.appendChild(warningSpan);
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date(bookmark.timestamp).toLocaleString();
    metaDiv.appendChild(timeSpan);

    // ライブ配信の場合、配信開始からの経過時間をテキスト表示して手動復元の目安にする
    if (bookmark.isLive) {
      const liveDurationSpan = document.createElement('span');
      liveDurationSpan.className = 'live-duration';
      liveDurationSpan.textContent = ` (配信開始から ${formatSecondsToTimeString(bookmark.relativeTime)})`;
      liveDurationSpan.style.color = '#adadb8';
      liveDurationSpan.style.marginLeft = '4px';
      metaDiv.appendChild(liveDurationSpan);
    }

    infoDiv.appendChild(metaDiv);

    // ビデオタイトル
    const titleDiv = document.createElement('div');
    titleDiv.className = 'bookmark-title';
    titleDiv.textContent = bookmark.title;
    infoDiv.appendChild(titleDiv);

    link.appendChild(infoDiv);

    // 2. 再生時間バッジ (VOD動画のみ表示)
    if (!bookmark.isLive) {
      const timeBadge = document.createElement('span');
      timeBadge.className = 'time-badge';
      timeBadge.textContent = formatSecondsToTimeString(bookmark.relativeTime);
      link.appendChild(timeBadge);
    }

    li.appendChild(link);

    // 2.2 アクションボタン群（コピー / VOD ID編集 / 削除）
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    // コピーボタン: VOD URLがあればタイムスタンプ付き完全URL、なければ t= パラメータ値をコピー
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn icon-btn';
    copyBtn.textContent = '📋';
    bindTooltip(copyBtn, () =>
      hasVodUrl
        ? 'タイムスタンプ付きURLをコピー'
        : `タイムスタンプ (?t=${formatSecondsToTwitchTimestamp(bookmark.relativeTime)}) をコピー`,
    );
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      // VOD URL未設定の場合は、アーカイブURLの末尾にそのまま貼り付けられる ?t= 形式でコピーする
      const text = hasVodUrl
        ? buildJumpUrl(bookmark.videoUrl, bookmark.relativeTime)
        : `?t=${formatSecondsToTwitchTimestamp(bookmark.relativeTime)}`;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '✓';
        setTimeout(() => {
          copyBtn.textContent = '📋';
        }, 1500);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    };
    actionsDiv.appendChild(copyBtn);

    // VOD ID編集ボタン
    const vodEditBtn = document.createElement('button');
    vodEditBtn.className = 'vod-edit-btn icon-btn';
    vodEditBtn.textContent = '✎';
    bindTooltip(vodEditBtn, () => '動画アーカイブURLを編集');
    actionsDiv.appendChild(vodEditBtn);

    // 2.5 メモエリアの追加
    const memoDiv = document.createElement('div');
    memoDiv.className = 'memo-container';

    const memoSpan = document.createElement('span');
    memoSpan.className = 'memo-text';
    memoSpan.textContent = bookmark.memo ? sanitizeString(bookmark.memo, 100) : 'メモを追加...';
    if (!bookmark.memo) {
      memoSpan.classList.add('empty-memo');
    }

    const memoInput = document.createElement('input');
    memoInput.type = 'text';
    memoInput.className = 'memo-input hidden';
    memoInput.value = bookmark.memo || '';
    memoInput.maxLength = 100;
    memoInput.placeholder = 'メモを入力してEnterで保存';

    memoSpan.onclick = (e) => {
      e.stopPropagation();
      memoSpan.classList.add('hidden');
      memoInput.classList.remove('hidden');
      memoInput.focus();
    };

    const saveMemo = async () => {
      const newMemo = memoInput.value.trim();
      memoInput.classList.add('hidden');
      memoSpan.classList.remove('hidden');

      if (newMemo === (bookmark.memo || '')) {
        return; // 変更なし
      }

      const updatedBookmark = { ...bookmark, memo: newMemo || undefined };
      allBookmarks = allBookmarks.map((b) => (b.id === bookmark.id ? updatedBookmark : b));
      filteredBookmarks = filteredBookmarks.map((b) =>
        b.id === bookmark.id ? updatedBookmark : b,
      );

      memoSpan.textContent = newMemo ? newMemo : 'メモを追加...';
      if (newMemo) {
        memoSpan.classList.remove('empty-memo');
      } else {
        memoSpan.classList.add('empty-memo');
      }

      await storageManager.updateBookmarkMemo(bookmark.id, newMemo);
    };

    memoInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveMemo();
      }
      if (e.key === 'Escape') {
        memoInput.value = bookmark.memo || '';
        memoInput.classList.add('hidden');
        memoSpan.classList.remove('hidden');
      }
    };
    memoInput.onblur = () => {
      saveMemo();
    };

    memoDiv.appendChild(memoSpan);
    memoDiv.appendChild(memoInput);
    li.appendChild(memoDiv);

    // 2.6 アクションボタン行はメモの下に配置
    li.appendChild(actionsDiv);

    // 2.7 VOD ID入力エリア（編集ボタンで表示切り替え）
    const vodEditContainer = document.createElement('div');
    vodEditContainer.className = 'vod-edit-container hidden';

    const vodInput = document.createElement('input');
    vodInput.type = 'text';
    vodInput.className = 'vod-input';
    vodInput.placeholder = 'VOD ID または https://www.twitch.tv/videos/... を入力してEnterで保存';
    vodEditContainer.appendChild(vodInput);

    const closeVodEdit = () => {
      vodEditContainer.classList.add('hidden');
      vodInput.value = '';
    };

    vodEditBtn.onclick = (e) => {
      e.stopPropagation();
      if (vodEditContainer.classList.contains('hidden')) {
        vodEditContainer.classList.remove('hidden');
        // 既存のVOD URLがあれば初期値として表示
        vodInput.value = hasVodUrl ? bookmark.videoUrl : '';
        vodInput.focus();
      } else {
        closeVodEdit();
      }
    };

    const saveVodId = async () => {
      const rawInput = vodInput.value.trim();
      if (!rawInput) {
        closeVodEdit();
        return;
      }

      const vodId = parseVodIdInput(rawInput);
      if (!vodId) {
        alert(
          'VOD ID（数字）または https://www.twitch.tv/videos/... 形式のURLを入力してください。',
        );
        return;
      }

      const newVideoUrl = buildVodUrl(vodId);
      closeVodEdit();

      await storageManager.updateBookmarkVideoUrl(bookmark.id, newVideoUrl);

      // メモリ内キャッシュを更新して再描画（アーカイブ紐付けにより isLive は false になる）
      const updatedBookmark = { ...bookmark, videoUrl: newVideoUrl, isLive: false };
      allBookmarks = allBookmarks.map((b) => (b.id === bookmark.id ? updatedBookmark : b));
      renderBookmarkList(allBookmarks, false);
    };

    vodInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveVodId();
      }
      if (e.key === 'Escape') {
        closeVodEdit();
      }
    };

    li.appendChild(vodEditContainer);

    // 3. 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑';
    bindTooltip(deleteBtn, () => 'ブックマークを削除');
    deleteBtn.onclick = async () => {
      // 誤クリック防止のための確認ダイアログ
      if (!confirm(`このブックマークを削除しますか？\n「${bookmark.title}」`)) {
        return;
      }

      // 楽観的UI更新
      li.remove();
      allBookmarks = allBookmarks.filter((b) => b.id !== bookmark.id);
      filteredBookmarks = filteredBookmarks.filter((b) => b.id !== bookmark.id);

      await storageManager.deleteBookmark(bookmark.id);

      if (listElement.children.length === 0 && filteredBookmarks.length === 0) {
        emptyElement.textContent =
          activeFilter === 'current'
            ? 'この動画のブックマーク履歴はありません。'
            : 'ブックマークがありません。 Alt+B またはチャットで打刻してください。';
        emptyElement.classList.remove('hidden');
      }
    };
    actionsDiv.appendChild(deleteBtn);

    fragment.appendChild(li);
  });

  listElement.appendChild(fragment);
}

/**
 * 設定情報の描画処理
 */
function renderSettings(settings: Settings): void {
  currentSettings = settings;

  const toggle = document.getElementById('chat-observer-toggle') as HTMLInputElement;
  if (toggle) {
    toggle.checked = settings.enableChatObserver;
  }

  const listElement = document.getElementById('trigger-words-list');
  if (!listElement) return;

  listElement.innerHTML = '';

  const fragment = document.createDocumentFragment();

  settings.triggerWords.forEach((word) => {
    const li = document.createElement('li');
    li.className = 'tag-item';

    const span = document.createElement('span');
    span.textContent = word;
    li.appendChild(span);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-tag-btn';
    removeBtn.textContent = '✕';
    removeBtn.onclick = async () => {
      const updatedWords = settings.triggerWords.filter((w) => w !== word);
      const newSettings = { ...settings, triggerWords: updatedWords };

      await storageManager.saveSettings(newSettings);
      renderSettings(newSettings);
    };
    li.appendChild(removeBtn);

    fragment.appendChild(li);
  });

  listElement.appendChild(fragment);
}

/**
 * 各種イベントリスナーの設定
 */
function setupEventListeners(): void {
  // 1. タブ切り替えロジック
  const tabHistoryBtn = document.getElementById('tab-history-btn');
  const tabSettingsBtn = document.getElementById('tab-settings-btn');
  const tabHistoryContent = document.getElementById('tab-history');
  const tabSettingsContent = document.getElementById('tab-settings');

  if (tabHistoryBtn && tabSettingsBtn && tabHistoryContent && tabSettingsContent) {
    tabHistoryBtn.onclick = () => {
      tabHistoryBtn.classList.add('active');
      tabSettingsBtn.classList.remove('active');
      tabHistoryContent.classList.remove('hidden');
      tabSettingsContent.classList.add('hidden');
    };

    tabSettingsBtn.onclick = () => {
      tabSettingsBtn.classList.add('active');
      tabHistoryBtn.classList.remove('active');
      tabSettingsContent.classList.remove('hidden');
      tabHistoryContent.classList.add('hidden');
    };
  }

  // 1-2. フィルター切り替えロジック
  const filterCurrentBtn = document.getElementById('filter-current-btn');
  const filterAllBtn = document.getElementById('filter-all-btn');

  if (filterCurrentBtn && filterAllBtn) {
    filterCurrentBtn.onclick = () => {
      if (activeFilter === 'current') return;
      activeFilter = 'current';
      filterCurrentBtn.classList.add('active');
      filterAllBtn.classList.remove('active');
      renderBookmarkList(allBookmarks, false);
    };

    filterAllBtn.onclick = () => {
      if (activeFilter === 'all') return;
      activeFilter = 'all';
      filterAllBtn.classList.add('active');
      filterCurrentBtn.classList.remove('active');
      renderBookmarkList(allBookmarks, false);
    };
  }

  // 2. 全件削除ボタン
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.onclick = async () => {
      if (confirm('すべてのブックマーク履歴を削除しますか？')) {
        await storageManager.clearAllBookmarks();
        renderBookmarkList([]);
      }
    };
  }

  // 3. チャット監視有効/無効トグル
  const chatToggle = document.getElementById('chat-observer-toggle') as HTMLInputElement;
  if (chatToggle) {
    chatToggle.onchange = async () => {
      if (!currentSettings) return;

      const newSettings: Settings = {
        ...currentSettings,
        enableChatObserver: chatToggle.checked,
      };
      await storageManager.saveSettings(newSettings);
      currentSettings = newSettings;
    };
  }

  // 4. 新規トリガーワード追加
  const triggerInput = document.getElementById('trigger-word-input') as HTMLInputElement;
  const addTriggerBtn = document.getElementById('add-trigger-btn');

  if (triggerInput && addTriggerBtn) {
    const handleAdd = async () => {
      if (!currentSettings) return;

      const inputVal = triggerInput.value?.trim();
      if (!inputVal) return;

      const cleanWord = sanitizeString(inputVal, 50);

      if (currentSettings.triggerWords.includes(cleanWord)) {
        alert('そのキーワードは既に登録されています。');
        return;
      }

      const updatedWords = [...currentSettings.triggerWords, cleanWord];
      const newSettings = {
        ...currentSettings,
        triggerWords: updatedWords,
      };

      await storageManager.saveSettings(newSettings);
      renderSettings(newSettings);
      triggerInput.value = '';
    };

    addTriggerBtn.onclick = handleAdd;
    triggerInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        handleAdd();
      }
    };
  }

  // 5. 無限スクロール監視設定 (.list-wrapper のスクロール検知)
  const listWrapper = document.querySelector('.list-wrapper');
  if (listWrapper) {
    listWrapper.addEventListener('scroll', () => {
      hideTooltip();
      const { scrollTop, scrollHeight, clientHeight } = listWrapper;
      // 最下部から 20px 以内に近づいたら次のページを追加でレンダリング
      if (scrollHeight - scrollTop - clientHeight < 20) {
        const currentListElement = document.getElementById('bookmark-list');
        const currentCount = currentListElement?.children.length || 0;

        if (currentCount < filteredBookmarks.length) {
          renderBookmarkList(allBookmarks, true);
        }
      }
    });
  }

  // 6. 他のタブや打刻によるストレージの変更を検知してリアルタイム同期
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.bookmarks) {
      const newBookmarks = (changes.bookmarks.newValue || []) as Bookmark[];
      // 変更があったらリスト表示を最初から描き直す (同期)
      renderBookmarkList(newBookmarks, false);
    }
    if (areaName === 'sync' && changes.settings) {
      const newSettings = changes.settings.newValue as Settings;
      if (newSettings) {
        renderSettings(newSettings);
      }
    }
  });
}

/**
 * ポップアップ起動時の初期化処理
 */
export async function initPopup(): Promise<void> {
  hideTooltip();
  // テスト間や再開時の状態リークを防ぐために明示的に初期化
  activeFilter = 'current';
  activeTabUrl = null;
  activeTabTitle = null;
  activeTabChannel = null;
  activeTabChannelLogin = null;
  activeTabIsLive = false;

  // 現在のアクティブなタブを検索
  const activeTab = await new Promise<chrome.tabs.Tab | null>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] || null);
    });
  });

  if (activeTab && activeTab.id && activeTab.url) {
    activeTabUrl = activeTab.url;

    // Twitchページであれば、Content Script にリアルタイム情報を問い合わせる
    if (activeTab.url.includes('twitch.tv')) {
      await new Promise<void>((resolve) => {
        chrome.tabs.sendMessage(
          activeTab.id!,
          { action: MESSAGE_ACTIONS.GET_VIDEO_INFO },
          (response) => {
            if (chrome.runtime.lastError) {
              // Content Scriptがロードされていない、または非アクティブな場合はフォールバック
              console.warn(
                'Failed to communicate with content script:',
                chrome.runtime.lastError.message,
              );
            } else if (response && response.success) {
              activeTabUrl = response.videoUrl || activeTab.url;
              activeTabTitle = response.title || null;
              activeTabChannel = response.channelName || null;
              // ログイン名はContent Scriptの応答を優先し、なければタブURLから導出
              activeTabChannelLogin =
                response.channelLogin || getChannelLoginFromUrl(activeTab.url || '') || null;
              activeTabIsLive = !!response.isLive;
            }
            resolve();
          },
        );
      });
    }
  }

  // 非Twitchページで開いた場合は、デフォルトで「すべて表示」にして空画面を避ける
  const isTwitchVideoOrLive =
    activeTabUrl &&
    activeTabUrl.includes('twitch.tv') &&
    (activeTabUrl.includes('/videos/') || activeTabChannel);
  if (!isTwitchVideoOrLive) {
    activeFilter = 'all';
  }

  setupEventListeners();

  // フィルターボタンの初期アクティブクラスを調整
  const filterCurrentBtn = document.getElementById('filter-current-btn');
  const filterAllBtn = document.getElementById('filter-all-btn');
  if (filterCurrentBtn && filterAllBtn) {
    if (activeFilter === 'all') {
      filterCurrentBtn.classList.remove('active');
      filterAllBtn.classList.add('active');
    } else {
      filterCurrentBtn.classList.add('active');
      filterAllBtn.classList.remove('active');
    }
  }

  const [bookmarks, settings] = await Promise.all([
    storageManager.getBookmarks(),
    storageManager.getSettings(),
  ]);

  renderBookmarkList(bookmarks);
  renderSettings(settings);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
