import { ChatCallback, ChatObservable } from '../platforms/adapter.interface';

/** Twitchのログイン名として妥当な形式（英数字とアンダースコアのみ） */
const VALID_LOGIN_PATTERN = /^[a-zA-Z0-9_]{1,50}$/;

/**
 * TwitchのCookie文字列からログイン中ユーザーのログイン名（小文字）を抽出する
 * 別デバイス（スマホなど）から送信した自分のコメントを、チャット行の data-a-user
 * 属性との照合で検知するために使用する。
 * @param cookie document.cookie 相当の文字列
 * @returns ログイン名（小文字）。未ログインまたは解析不能な場合は null
 */
export function extractLoginFromCookie(cookie: string): string | null {
  // 1. twilight-user Cookie (URIエンコードされたJSON、login フィールドを含む)
  const twilightMatch = cookie.match(/(?:^|;\s*)twilight-user=([^;]+)/);
  if (twilightMatch) {
    try {
      const parsed = JSON.parse(decodeURIComponent(twilightMatch[1]));
      if (typeof parsed?.login === 'string' && VALID_LOGIN_PATTERN.test(parsed.login)) {
        return parsed.login.toLowerCase();
      }
    } catch (e) {
      // 解析失敗時は次の手段へフォールバック
    }
  }

  // 2. login Cookie (プレーンなログイン名)
  const loginMatch = cookie.match(/(?:^|;\s*)login=([^;]+)/);
  if (loginMatch) {
    try {
      const login = decodeURIComponent(loginMatch[1]).trim();
      if (VALID_LOGIN_PATTERN.test(login)) {
        return login.toLowerCase();
      }
    } catch (e) {
      // 不正なエンコーディングは無視
    }
  }

  return null;
}

/**
 * Twitchチャットの自発言およびトリガーキーワードを監視するクラス
 * IME（日本語入力）の二重送信バグ対策を強化し、低負荷な MutationObserver 設計を採用しています。
 *
 * 入力欄の監視は document レベルのイベント委譲（キャプチャフェーズ）で行います。
 * これにより以下の両方に対応できます:
 * - 現行Twitch UIの contenteditable エディタ（textarea ではない）
 * - SPA遷移などで入力欄が後からマウント/再マウントされるケース
 */
export class ChatObserver implements ChatObservable {
  private observing = false;
  private chatMutationObserver: MutationObserver | null = null;
  private lastTriggerTime = 0; // 重複打刻防止用のタイムスタンプ
  private readonly TRIGGER_COOLDOWN_MS = 1500; // 連続打刻防止のクールダウン時間
  private callback?: ChatCallback;

  // IME（日本語入力変換）状態の厳密な監視フラグ
  private isImeComposing = false;

  // ログイン中ユーザーのログイン名（小文字）。別デバイス発の自分のコメント検知に使用
  private ownLogin: string | null = null;

  // 各種イベントハンドラのバインド保持用
  private readonly handleKeyDownBound = this.handleKeyDown.bind(this);
  private readonly handleCompositionStartBound = this.handleCompositionStart.bind(this);
  private readonly handleCompositionEndBound = this.handleCompositionEnd.bind(this);

  constructor(
    callback: ChatCallback | undefined, // テスト・直接起動の双方の互換性のためオプショナルにする
    private readonly triggerWords: string[],
  ) {
    if (callback) {
      this.callback = callback;
    }
  }

  /**
   * 監視インターフェース (ChatObservable) の observeChat 実装
   * 引数のコールバックを正しくバインドして監視を開始します。
   */
  public observeChat(callback: ChatCallback): void {
    this.callback = callback;
    this.start();
  }

  /**
   * チャット入力エリアおよびログコンテナの監視を開始する
   */
  public start(): void {
    if (this.observing) return;
    this.observing = true;

    // 0. ログイン中ユーザー名をCookieから取得 (別デバイス発コメントの自己判定用)
    this.ownLogin = extractLoginFromCookie(document.cookie);

    // 1. document レベルでキーボード・IMEイベントを委譲監視 (キャプチャフェーズ)
    //    Twitchのエディタ(Slate)が stopPropagation してもキャプチャで先に受け取れる
    document.addEventListener('keydown', this.handleKeyDownBound, true);
    document.addEventListener('compositionstart', this.handleCompositionStartBound, true);
    document.addEventListener('compositionend', this.handleCompositionEndBound, true);

    // 2. チャットログコンテナの MutationObserver 監視を設定
    this.setupMutationObserver();
  }

  /**
   * 監視を完全に停止し、メモリおよびCPUリソースを解放する
   */
  public destroy(): void {
    if (!this.observing) return;
    this.observing = false;

    // document レベルの委譲リスナーの解除
    document.removeEventListener('keydown', this.handleKeyDownBound, true);
    document.removeEventListener('compositionstart', this.handleCompositionStartBound, true);
    document.removeEventListener('compositionend', this.handleCompositionEndBound, true);

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
   * イベントの発生元がチャット入力欄（textarea または contenteditable エディタ）であれば
   * その入力欄要素を返す。それ以外は null を返す。
   */
  private resolveChatInput(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>(
      '[data-a-target="chat-input"], .chat-wysiwyg-input__editor, .chat-input textarea',
    );
  }

  /**
   * 入力欄要素から現在の入力テキストを取得する
   * textarea は value、contenteditable エディタは textContent から取得する
   */
  private getInputText(input: HTMLElement): string {
    if (input instanceof HTMLTextAreaElement) {
      return input.value?.trim() || '';
    }
    return input.textContent?.trim() || '';
  }

  /**
   * IME入力開始イベントハンドラ
   */
  private handleCompositionStart(event: CompositionEvent): void {
    if (this.resolveChatInput(event.target)) {
      this.isImeComposing = true;
    }
  }

  /**
   * IME入力確定イベントハンドラ
   */
  private handleCompositionEnd(event: CompositionEvent): void {
    if (this.resolveChatInput(event.target)) {
      this.isImeComposing = false;
    }
  }

  /**
   * キーボードの入力をハンドリングする（IME二重防止強化、トリガーワード検知）
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // 1. IME日本語変換中のEnter入力およびkeyCode=229は完全に無視する (誤保存の徹底防止)
    if (event.isComposing || this.isImeComposing || event.keyCode === 229) {
      return;
    }

    if (event.key !== 'Enter') return;

    // 2. チャット入力欄由来のイベントのみ処理する (委譲先の判定)
    const input = this.resolveChatInput(event.target);
    if (!input) return;

    const text = this.getInputText(input);
    if (this.isTriggerWord(text)) {
      this.triggerCallback(text);
    }
  }

  /**
   * チャットログ追加を監視する MutationObserver のセットアップ
   */
  private setupMutationObserver(): void {
    const chatContainer =
      document.querySelector('.chat-scrollable-area__message-container') ||
      document.querySelector('[data-test-selector="chat-scrollable-area__message-container"]') ||
      document.querySelector('.chat-scrollable-area__list-container') ||
      document.querySelector('[data-a-target="chat-welcome-message"]')?.parentElement;

    if (!chatContainer) {
      this.observeBodyForChatContainer();
      return;
    }

    this.chatMutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            // 追加ノード自身、またはその内部のチャット行を特定
            const messageLine = element.classList.contains('chat-line__message')
              ? element
              : element.querySelector<HTMLElement>('.chat-line__message');
            if (!messageLine) {
              continue;
            }

            // 超低負荷設計: 自分の発言でない場合は即座に早期リターン (Early Return)
            // 現行Twitchでは data-a-user 属性（発言者のログイン名）とログインCookieの照合で判定する。
            // これによりスマホなど別デバイスから送信した自分のコメントも検知できる。
            const author = messageLine.getAttribute('data-a-user')?.toLowerCase() || null;
            const isSelf =
              (this.ownLogin !== null && author === this.ownLogin) ||
              messageLine.classList.contains('chat-line__message--self') ||
              !!messageLine.querySelector('.chat-line__message--self') ||
              author === 'me';

            if (!isSelf) {
              continue;
            }

            // メッセージテキスト要素からテキストを取得
            const messageElement =
              messageLine.querySelector('.message') ||
              messageLine.querySelector('[data-a-target="chat-message-text"]');

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
      // 監視停止済みの場合はフォールバック監視も終了する
      if (!this.observing) {
        observerInstance.disconnect();
        return;
      }

      const chatContainer =
        document.querySelector('.chat-scrollable-area__message-container') ||
        document.querySelector('.chat-scrollable-area__list-container');
      if (chatContainer) {
        this.setupMutationObserver();
        observerInstance.disconnect();
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 入力テキストがトリガーキーワードに一致するかチェックする
   * 完全一致に加え、「トリガーワード + 空白 + コメント」形式（メモ付き打刻）にも一致する
   */
  private isTriggerWord(text: string): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return this.triggerWords.some((word) => {
      const lowerWord = word.toLowerCase();
      return (
        lowerText === lowerWord ||
        lowerText.startsWith(lowerWord + ' ') ||
        lowerText.startsWith(lowerWord + '　') // 全角スペース区切りにも対応
      );
    });
  }

  /**
   * 重複防止クールダウン制御を挟んでコールバックを実行する
   */
  private triggerCallback(text: string): void {
    if (!this.callback) return;

    const now = Date.now();
    if (now - this.lastTriggerTime >= this.TRIGGER_COOLDOWN_MS) {
      this.lastTriggerTime = now;
      this.callback({ sender: 'self', text });
    }
  }
}
