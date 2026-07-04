import { ChatCallback, ChatObservable } from '../platforms/adapter.interface';

/**
 * Twitchチャットの自発言およびトリガーキーワードを監視するクラス
 */
export class ChatObserver implements ChatObservable {
  private observing = false;
  private chatMutationObserver: MutationObserver | null = null;
  private lastTriggerTime = 0; // 重複打刻防止用のタイムスタンプ
  private readonly TRIGGER_COOLDOWN_MS = 1500; // 連続打刻防止のクールダウン時間

  // キーボードイベントハンドラのバインド保持用
  private readonly handleKeyDownBound = this.handleKeyDown.bind(this);

  constructor(
    private readonly callback: ChatCallback,
    private readonly triggerWords: string[],
  ) {}

  /**
   * チャット入力エリアおよびログコンテナの監視を開始する
   */
  public start(): void {
    if (this.observing) return;
    this.observing = true;

    // 1. チャット入力エリア (textarea) のキーボードイベント監視を設定
    this.setupInputListener();

    // 2. チャットログコンテナの MutationObserver 監視を設定
    this.setupMutationObserver();
  }

  /**
   * 監視を完全に停止し、メモリおよびCPUリソースを解放する
   */
  public destroy(): void {
    if (!this.observing) return;
    this.observing = false;

    // イベントリスナーの解除
    const textarea = this.getInputElement();
    if (textarea) {
      textarea.removeEventListener('keydown', this.handleKeyDownBound);
    }

    // MutationObserver の切断 (CPU負荷を 0% に抑える)
    if (this.chatMutationObserver) {
      this.chatMutationObserver.disconnect();
      this.chatMutationObserver = null;
    }
  }

  /**
   * 現在監視中かどうかを返す
   */
  public isObserving(): boolean {
    return this.observing;
  }

  /**
   * チャット入力欄 (textarea) を取得する
   */
  private getInputElement(): HTMLTextAreaElement | null {
    return (
      document.querySelector('textarea[data-a-target="chat-input"]') ||
      document.querySelector('.chat-input textarea') ||
      document.querySelector('textarea')
    );
  }

  /**
   * キーボードイベントの登録を行う
   */
  private setupInputListener(): void {
    const textarea = this.getInputElement();
    if (textarea) {
      // 重複登録防止のため、一旦削除してから追加
      textarea.removeEventListener('keydown', this.handleKeyDownBound);
      textarea.addEventListener('keydown', this.handleKeyDownBound);
    }
  }

  /**
   * キーボードの入力をハンドリングする（IME考慮、トリガーワード検知）
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // 1. IME日本語変換中のEnter入力は無視する (XSS/誤動作防止)
    if (event.isComposing) {
      return;
    }

    if (event.key === 'Enter') {
      const textarea = event.currentTarget as HTMLTextAreaElement;
      const text = textarea.value?.trim();

      if (this.isTriggerWord(text)) {
        this.triggerCallback(text);
      }
    }
  }

  /**
   * チャットログ追加を監視する MutationObserver のセットアップ
   */
  private setupMutationObserver(): void {
    // Twitchのチャットログリストのコンテナセレクター
    const chatContainer =
      document.querySelector('.chat-scrollable-area__list-container') ||
      document.querySelector('[data-a-target="chat-welcome-message"]')?.parentElement;

    if (!chatContainer) {
      // チャット欄がまだロードされていない場合は、親要素などの監視からリトライするフォールバックも考慮するが、
      // 基本はDOMポーリング等で行う。ここでは MutationObserver でドキュメント全体からチャット欄出現を監視
      this.observeBodyForChatContainer();
      return;
    }

    this.chatMutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            
            // DRY / 超低負荷設計: 自分の発言を示すクラスがない場合は即座に早期リターン (Early Return)
            const isSelf =
              element.classList.contains('chat-line__message--self') ||
              element.querySelector('.chat-line__message--self') ||
              element.getAttribute('data-a-user') === 'me'; // テストやカスタム用属性
            
            if (!isSelf) {
              continue;
            }

            // メッセージテキスト要素からテキストを取得
            const messageElement =
              element.querySelector('.message') ||
              element.querySelector('[data-a-target="chat-message-text"]');
            
            const text = messageElement?.textContent?.trim() || '';
            if (this.isTriggerWord(text)) {
              this.triggerCallback(text);
            }
          }
        }
      }
    });

    this.chatMutationObserver.observe(chatContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * チャットコンテナが後からDOMに出現するケースに対応するためのボディ監視フォールバック
   */
  private observeBodyForChatContainer(): void {
    const bodyObserver = new MutationObserver((mutations, observerInstance) => {
      const chatContainer = document.querySelector('.chat-scrollable-area__list-container');
      if (chatContainer) {
        this.setupMutationObserver();
        observerInstance.disconnect(); // ボディの監視は終了
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 入力テキストがトリガーキーワードに一致するかチェックする
   */
  private isTriggerWord(text: string): boolean {
    if (!text) return false;
    // 大文字小文字を区別せず比較
    const lowerText = text.toLowerCase();
    return this.triggerWords.some((word) => word.toLowerCase() === lowerText);
  }

  /**
   * 重複防止クールダウン制御を挟んでコールバックを実行する
   */
  private triggerCallback(text: string): void {
    const now = Date.now();
    if (now - this.lastTriggerTime >= this.TRIGGER_COOLDOWN_MS) {
      this.lastTriggerTime = now;
      this.callback({ sender: 'self', text });
    }
  }

  /**
   * 監視インターフェース (ChatObservable) の observeChat 実装
   */
  public observeChat(callback: ChatCallback): void {
    // 既存の start メソッドを呼び出す
    this.start();
  }
}
