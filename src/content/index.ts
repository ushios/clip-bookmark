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

    // 3. Service Worker に保存を要求
    await chrome.runtime.sendMessage({
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
    });
  } catch (error) {
    console.error('Failed to auto-save bookmark:', error);
    if (toastManager) {
      toastManager.showError('保存に失敗しました');
    }
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
    chatObserver = new ChatObserver(
      // コールバック関数として共通の保存処理を指定
      () => triggerBookmarkSave(),
      settings.triggerWords,
    );
    chatObserver.start();
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

  // コマンドオブザーバーの起動 (キーボードショートカット Alt+Shift+B 用)
  // toastManager を直接渡して楽観的表示やエラー表示を行わせる
  commandObserver = new CommandObserver(twitchAdapter, toastManager);
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

// リソース解放イベントのハンドリング (拡張機能がアップデートまたは無効化された際の後始末)
window.addEventListener('unload', () => {
  if (twitchAdapter) twitchAdapter.destroy();
  if (toastManager) toastManager.destroy();
  if (commandObserver) commandObserver.destroy();
  if (chatObserver) chatObserver.destroy();
});
