import { PlatformAdapter } from '../platforms/adapter.interface';
import { MESSAGE_ACTIONS, ExtensionMessage } from '../../common/models/messages';

// 循環参照を避けるため、必要な場合はインターフェースまたは動的呼び出しにします。
// ここではトースト管理用の簡易インターフェースを定義するか、直接参照します。
export interface IToastManager {
  showSaving(): void;
  showError(message: string): void;
}

/**
 * Service Worker からのコマンド（キーボードショートカット）入力を監視し、
 * プレイヤー時間情報を取得して保存要求を送信するオブザーバー
 */
export class CommandObserver {
  private readonly handleMessageBound = this.handleMessage.bind(this);

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly toastManager?: IToastManager,
  ) {}

  /**
   * メッセージリスナーの登録を行い、監視を開始する
   */
  public start(): void {
    chrome.runtime.onMessage.addListener(this.handleMessageBound);
  }

  /**
   * 監視を停止し、リスナーを解除する
   */
  public destroy(): void {
    chrome.runtime.onMessage.removeListener(this.handleMessageBound);
  }

  /**
   * メッセージ受信ハンドラ
   */
  private async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    if (message.action === MESSAGE_ACTIONS.TRIGGER_BOOKMARK) {
      try {
        // 1. 楽観的UI更新：トーストに「保存中...」を表示
        if (this.toastManager) {
          this.toastManager.showSaving();
        }

        // 2. プレイヤーから再生情報などのデータを抽出 (TwitchAdapter を介す)
        const [relativeTime, channelName, title, videoUrl, isLive] = await Promise.all([
          this.adapter.getCurrentTime(),
          this.adapter.getChannelName(),
          this.adapter.getVideoTitle(),
          this.adapter.getVideoUrl(),
          this.adapter.isLive(),
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
      } catch (error: any) {
        console.error('CommandObserver error during bookmark creation:', error);
        if (this.toastManager) {
          this.toastManager.showError('保存に失敗しました');
        }
      }
    }
  }
}
