import { StorageManager } from '../common/storage/storage.manager';
import { Bookmark } from '../common/models/bookmark.model';
import { Settings } from '../common/models/settings.model';
import { formatSecondsToTimeString } from '../common/utils/time';
import { validateVideoUrl, sanitizeString } from '../common/utils/security';

/**
 * ポップアップUIの各種イベントハンドリングおよび描画を制御するモジュール
 */

const storageManager = StorageManager.getInstance();
let currentSettings: Settings | null = null;

/**
 * 秒数をTwitchのタイムスタンプパラメータ形式 (XhYmZs) に変換する
 */
function toTwitchTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  // 時間が 0 の場合も一貫して XhYmZs の形式で出力
  return `${hours}h${pad(minutes)}m${pad(secs)}s`;
}

/**
 * 安全なURL遷移処理
 */
function navigateToBookmark(bookmark: Bookmark): void {
  let targetUrl = bookmark.videoUrl;

  // VOD（アーカイブ動画）の場合はタイムスタンプを付与
  if (bookmark.videoUrl.includes('/videos/') && bookmark.relativeTime >= 0) {
    const timestampParam = `t=${toTwitchTimestamp(bookmark.relativeTime)}`;
    const separator = bookmark.videoUrl.includes('?') ? '&' : '?';
    targetUrl = `${bookmark.videoUrl}${separator}${timestampParam}`;
  }

  // セキュリティ: URLがTwitchのもの且つ安全な形式か検証
  if (validateVideoUrl(targetUrl)) {
    chrome.tabs.create({ url: targetUrl });
  } else {
    console.error('Blocked unsafe URL transition:', targetUrl);
    alert('安全ではないURLへの遷移がブロックされました。');
  }
}

/**
 * 履歴リストの描画処理（DocumentFragment による高速描画）
 */
function renderBookmarkList(bookmarks: Bookmark[]): void {
  const listElement = document.getElementById('bookmark-list');
  const emptyElement = document.getElementById('no-bookmarks');
  if (!listElement || !emptyElement) return;

  listElement.innerHTML = '';

  // 最新順にソートし、最大50件に制限
  const displayList = [...bookmarks]
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    })
    .slice(0, 50);

  if (displayList.length === 0) {
    emptyElement.classList.remove('hidden');
    return;
  }

  emptyElement.classList.add('hidden');

  const fragment = document.createDocumentFragment();

  displayList.forEach((bookmark) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.dataset.id = bookmark.id;

    // 1. ブックマーク情報リンクエリア (XSS対策：createElement & textContent の徹底)
    const link = document.createElement('a');
    link.className = 'bookmark-link';
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      navigateToBookmark(bookmark);
    };

    const infoDiv = document.createElement('div');
    infoDiv.className = 'bookmark-info';

    // メタ情報 (チャンネル名、日時、ライブバッジ)
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

    // 2. 再生時間バッジ
    const timeBadge = document.createElement('span');
    timeBadge.className = 'time-badge';
    timeBadge.textContent = formatSecondsToTimeString(bookmark.relativeTime);
    link.appendChild(timeBadge);

    li.appendChild(link);

    // 3. 削除ボタン (楽観的UI更新：即時にDOMから要素を消去)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑';
    deleteBtn.title = '削除';
    deleteBtn.onclick = async () => {
      // 楽観的にDOMから即座に削除
      li.remove();
      
      // 非同期でストレージから消去
      await storageManager.deleteBookmark(bookmark.id);
      
      // 全件消去後の空表示チェック
      const currentList = await storageManager.getBookmarks();
      if (currentList.length === 0) {
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

  // 1. チャット監視トグルの設定
  const toggle = document.getElementById('chat-observer-toggle') as HTMLInputElement;
  if (toggle) {
    toggle.checked = settings.enableChatObserver;
  }

  // 2. トリガーワードのタグリスト描画
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

    // キーワード削除ボタン
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
      // 入力検証 & サニライズ
      if (!inputVal) return;

      const cleanWord = sanitizeString(inputVal, 50);

      // 重複チェック
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
}

/**
 * ポップアップ起動時の初期化処理
 */
export async function initPopup(): Promise<void> {
  setupEventListeners();

  // ブックマーク履歴と設定の読み込みを非同期で並行実行
  const [bookmarks, settings] = await Promise.all([
    storageManager.getBookmarks(),
    storageManager.getSettings(),
  ]);

  renderBookmarkList(bookmarks);
  renderSettings(settings);
}

// ロード完了時にポップアップ初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
