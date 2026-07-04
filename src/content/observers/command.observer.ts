import { MESSAGE_ACTIONS, ExtensionMessage } from '../../common/models/messages';

export type CommandTriggerCallback = () => void;

/**
 * Service Worker からのコマンド（キーボードショートカット）入力を監視し、
 * メッセージ検知時に安全にコールバックを呼び出すオブザーバー
 */
export class CommandObserver {
  private readonly handleMessageBound = this.handleMessage.bind(this);

  constructor(private readonly callback: CommandTriggerCallback) {}

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
  private handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): void {
    // セキュリティ: 送信元拡張機能IDの検証
    if (sender.id !== chrome.runtime.id) {
      console.warn('Blocked TRIGGER_BOOKMARK message from unauthorized sender:', sender.id);
      return;
    }

    if (message.action === MESSAGE_ACTIONS.TRIGGER_BOOKMARK) {
      this.callback();
    }
  }
}
