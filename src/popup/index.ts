import { StorageManager } from '../common/storage/storage.manager';
import { Bookmark } from '../common/models/bookmark.model';
import { Settings } from '../common/models/settings.model';
import { MESSAGE_ACTIONS } from '../common/models/messages';
import { formatSecondsToTimeString } from '../common/utils/time';
import { validateVideoUrl, sanitizeString } from '../common/utils/security';

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
let activeTabIsLive: boolean = false;
const PAGE_SIZE = 50;

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
 * 秒数をTwitchのタイムスタンプパラメータ形式 (XhYmZs) に変換する
 */
function toTwitchTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  return `${hours}h${pad(minutes)}m${pad(secs)}s`;
}

/**
 * 安全なURL遷移処理
 */
function navigateToBookmark(bookmark: Bookmark): void {
  let targetUrl = bookmark.videoUrl;

  if (bookmark.videoUrl.includes('/videos/') && bookmark.relativeTime >= 0) {
    const timestampParam = `t=${toTwitchTimestamp(bookmark.relativeTime)}`;
    const separator = bookmark.videoUrl.includes('?') ? '&' : '?';
    targetUrl = `${bookmark.videoUrl}${separator}${timestampParam}`;
  }

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
    if (activeTabIsLive && activeTabChannel) {
      // ライブ配信中の場合：チャンネル名と現在の配信タイトルが一致するブックマークのみを表示
      targetList = targetList.filter((b) => {
        return b.isLive && 
               b.channelName === activeTabChannel && 
               b.title === activeTabTitle;
      });
    } else if (activeTabUrl) {
      // VOD（アーカイブ動画）の場合：動画ID（ベースURL）が一致するブックマークのみを表示
      const currentBase = getBaseUrl(activeTabUrl);
      targetList = targetList.filter((b) => !b.isLive && getBaseUrl(b.videoUrl) === currentBase);
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
      emptyElement.textContent = activeFilter === 'current'
        ? 'この動画のブックマーク履歴はありません。'
        : 'ブックマークがありません。 Alt+Shift+B またはチャットで打刻してください。';
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

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date(bookmark.timestamp).toLocaleString();
    metaDiv.appendChild(timeSpan);

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

    // 3. 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑';
    deleteBtn.title = '削除';
    deleteBtn.onclick = async () => {
      // 楽観的UI更新
      li.remove();
      allBookmarks = allBookmarks.filter((b) => b.id !== bookmark.id);
      filteredBookmarks = filteredBookmarks.filter((b) => b.id !== bookmark.id);
      
      await storageManager.deleteBookmark(bookmark.id);
      
      if (listElement.children.length === 0 && filteredBookmarks.length === 0) {
        emptyElement.textContent = activeFilter === 'current'
          ? 'この動画のブックマーク履歴はありません。'
          : 'ブックマークがありません。 Alt+Shift+B またはチャットで打刻してください。';
        emptyElement.classList.remove('hidden');
      }
    };
    li.appendChild(deleteBtn);

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
  // テスト間や再開時の状態リークを防ぐために明示的に初期化
  activeFilter = 'current';
  activeTabUrl = null;
  activeTabTitle = null;
  activeTabChannel = null;
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
        chrome.tabs.sendMessage(activeTab.id!, { action: MESSAGE_ACTIONS.GET_VIDEO_INFO }, (response) => {
          if (chrome.runtime.lastError) {
            // Content Scriptがロードされていない、または非アクティブな場合はフォールバック
            console.warn('Failed to communicate with content script:', chrome.runtime.lastError.message);
          } else if (response && response.success) {
            activeTabUrl = response.videoUrl || activeTab.url;
            activeTabTitle = response.title || null;
            activeTabChannel = response.channelName || null;
            activeTabIsLive = !!response.isLive;
          }
          resolve();
        });
      });
    }
  }

  // 非Twitchページで開いた場合は、デフォルトで「すべて表示」にして空画面を避ける
  const isTwitchVideoOrLive = activeTabUrl && activeTabUrl.includes('twitch.tv') && (activeTabUrl.includes('/videos/') || activeTabChannel);
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
