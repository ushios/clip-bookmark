import { TwitchAdapter } from './platforms/twitch.adapter';
import { CommandObserver } from './observers/command.observer';
import { ChatObserver } from './observers/chat.observer';
import { ToastManager } from './ui/toast.manager';
import { StorageManager } from '../common/storage/storage.manager';
import { MESSAGE_ACTIONS } from '../common/models/messages';
import { Settings } from '../common/models/settings.model';

/**
 * Content Script のエントリポイント
 * 各監視オブザーバー、プラットフォームアダプター、トースト通知UIのライフサイクルを制御します。
 */

let twitchAdapter: TwitchAdapter | null = null;
let toastManager: ToastManager | null = null;
let commandObserver: CommandObserver | null = null;
let chatObserver: ChatObserver | null = null;
const storageManager = StorageManager.getInstance();

/**
 * ブックマーク保存の共通処理（チャット検知・コマンド検知の両方から呼び出されます）
 * ゴーストトースト防止のため、メッセージ送信完了のレスポンス（Request-Response）を待って、
 * このアクティブタブのトースト通知のみを「保存完了」に更新します。
 */
async function triggerBookmarkSave(): Promise<void> {
  if (!twitchAdapter || !toastManager) return;

  try {
    // 1. 楽観的UI更新：保存中トーストを表示
    toastManager.showSaving();

    // 2. DOMから現在時間等の情報を抽出
    const [relativeTime, channelName, title, videoUrl, isLive] = await Promise.all([
      twitchAdapter.getCurrentTime(),
      twitchAdapter.getChannelName(),
      twitchAdapter.getVideoTitle(),
      twitchAdapter.getVideoUrl(),
      twitchAdapter.isLive(),
    ]);

    // 3. Service Worker に保存を要求し、成否レスポンスを待つ
    chrome.runtime.sendMessage(
      {
        action: MESSAGE_ACTIONS.SAVE_BOOKMARK,
        payload: {
          id: Date.now().toString(),
          platform: 'twitch',
          channelName,
          title,
          videoUrl,
          timestamp: new Date().toISOString(),
          relativeTime,
          isLive,
        },
      },
      (response) => {
        // レスポンスの検証（chrome.runtime.lastErrorのチェックも含む）
        if (chrome.runtime.lastError) {
          console.error('SendMessage error:', chrome.runtime.lastError.message);
          toastManager?.showError('保存要求の送信に失敗しました');
          return;
        }

        if (response && response.success) {
          // 保存に成功した時のみ、このタブで「保存完了」を表示
          toastManager?.showSuccess(relativeTime, isLive);
        } else {
          const errorMsg = response?.error || '保存に失敗しました';
          toastManager?.showError(errorMsg);
        }
      },
    );
  } catch (error) {
    console.error('Failed to auto-save bookmark:', error);
    toastManager.showError('保存に失敗しました');
  }
}

/**
 * チャット監視オブザーバーの初期化・更新処理
 */
function updateChatObserver(settings: Settings): void {
  // 既存のチャットオブザーバーがあれば一度破棄
  if (chatObserver) {
    chatObserver.destroy();
    chatObserver = null;
  }

  // 設定でチャット監視が有効な場合のみ、新規作成して起動 (CPU負荷の最適化)
  if (settings.enableChatObserver) {
    // コンストラクタでコールバックを渡さず、observeChat(callback) を使用する新設計に対応
    chatObserver = new ChatObserver(undefined, settings.triggerWords);
    chatObserver.observeChat(() => triggerBookmarkSave());
  }
}

/**
 * 拡張機能 Content Script の初期化処理
 */
async function initialize(): Promise<void> {
  // すでに初期化済みの場合はスキップ
  if (twitchAdapter) return;

  // 各種マネージャーやアダプターのインスタンス化
  twitchAdapter = new TwitchAdapter();
  toastManager = new ToastManager();
  toastManager.start();

  // コマンドオブザーバーの起動。コールバックとして triggerBookmarkSave を渡す（関心分離）
  commandObserver = new CommandObserver(() => triggerBookmarkSave());
  commandObserver.start();

  // 同期ストレージから設定を取得し、チャット監視を構成
  const settings = await storageManager.getSettings();
  updateChatObserver(settings);

  // 設定の同期変更を監視 (設定ポップアップでの変更にリアルタイム追従)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.settings) {
      const newSettings = changes.settings.newValue as Settings;
      if (newSettings) {
        updateChatObserver(newSettings);
      }
    }
  });
}

// ページのロード完了時に初期化処理を起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// 他のコンテキスト (Popupなど) からの動画情報取得要求への応答
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message.action === MESSAGE_ACTIONS.GET_VIDEO_INFO) {
    if (!twitchAdapter) {
      sendResponse({ success: false, error: 'Adapter not initialized' });
      return;
    }

    Promise.all([
      twitchAdapter.getVideoUrl(),
      twitchAdapter.getVideoTitle(),
      twitchAdapter.getChannelName(),
      twitchAdapter.isLive(),
    ]).then(([videoUrl, title, channelName, isLive]) => {
      sendResponse({
        success: true,
        videoUrl,
        title,
        channelName,
        isLive,
      });
    }).catch((err) => {
      console.error('Failed to get video info:', err);
      sendResponse({ success: false, error: err.message });
    });

    return true; // 非同期応答を有効化
  }
});

// リソース解放イベントのハンドリング
window.addEventListener('unload', () => {
  if (twitchAdapter) twitchAdapter.destroy();
  if (toastManager) toastManager.destroy();
  if (commandObserver) commandObserver.destroy();
  if (chatObserver) chatObserver.destroy();
});
