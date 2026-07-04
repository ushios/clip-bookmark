import { formatSecondsToTimeString } from '../../common/utils/time';

/**
 * トースト通知管理用のインターフェース
 */
export interface IToastManager {
  showSaving(): void;
  showError(message: string): void;
  showSuccess(relativeTime: number): void;
}

/**
 * Twitchプレイヤー上に Shadow DOM を用いて最前面に安全なトースト通知を描画・管理するクラス
 * ゴーストトースト防止のため、ストレージ監視を排し、直接API呼び出しで描画制御を行います。
 */
export class ToastManager implements IToastManager {
  private hostElement: HTMLDivElement | null = null;
  private autoCloseTimeout: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * 初期設定（将来の拡張用。現在はダミー処理）
   */
  public start(): void {
    // 処理なし（ゴーストトースト対策でストレージ監視を廃止）
  }

  /**
   * マウントされた要素があれば破棄する
   */
  public destroy(): void {
    this.removeToast();
  }

  /**
   * 「保存中...」の楽観的UI表示を行う
   */
  public showSaving(): void {
    this.renderToast('ブックマークを保存中...', 'saving');
  }

  /**
   * 「XX:XX:XX を保存しました」の完了表示を行う
   */
  public showSuccess(relativeTime: number, isLive = false): void {
    const timeStr = formatSecondsToTimeString(relativeTime);
    if (isLive) {
      const now = new Date();
      const timeStrLocal = now.toTimeString().split(' ')[0]; // hh:mm:ss
      this.renderToast(`${timeStr} (実時間: ${timeStrLocal}) を記録しました`, 'success');
    } else {
      this.renderToast(`${timeStr} をブックマークしました`, 'success');
    }
  }

  /**
   * エラーメッセージの表示を行う
   */
  public showError(message: string): void {
    this.renderToast(message, 'error');
  }

  /**
   * トースト要素をDOM（Shadow DOM）に構築して描画する
   */
  private renderToast(message: string, type: 'saving' | 'success' | 'error'): void {
    // 1. 挿入先コンテナの決定 (フルスクリーン対応のためプレイヤーコンテナを優先)
    const container =
      document.querySelector('.video-player__container') ||
      document.querySelector('.video-player') ||
      document.body;

    if (!container) return;

    // 2. ホスト要素がなければ作成
    if (!this.hostElement) {
      this.hostElement = document.createElement('div');
      this.hostElement.className = 'twitch-bookmark-toast-host';
      this.hostElement.style.position = 'absolute';
      this.hostElement.style.top = '20px';
      this.hostElement.style.right = '20px';
      this.hostElement.style.zIndex = '999999';
      this.hostElement.style.pointerEvents = 'none'; // 背後の操作を邪魔しない

      container.appendChild(this.hostElement);
    }

    // 3. Shadow DOM をアタッチ (未作成の場合のみ)
    let shadow = this.hostElement.shadowRoot;
    if (!shadow) {
      shadow = this.hostElement.attachShadow({ mode: 'open' });
    }

    // 4. Shadow DOM 内の HTML・CSS 構築
    // XSS対策：textContent を用いて安全に文字列を注入
    shadow.innerHTML = '';

    // スタイル定義
    const style = document.createElement('style');
    style.textContent = `
      .toast-container {
        background-color: rgba(24, 24, 27, 0.95);
        color: #efeff1;
        padding: 12px 16px;
        border-radius: 4px;
        font-family: Inter, Roobert, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        border-left: 4px solid #9146ff;
        pointer-events: auto; /* ボタン操作などを有効化 */
        transition: opacity 0.2s ease, transform 0.2s ease;
        opacity: 0;
        transform: translateY(-10px);
      }
      .toast-container.show {
        opacity: 1;
        transform: translateY(0);
      }
      .toast-container.saving {
        border-left-color: #ffd700; /* ゴールド */
      }
      .toast-container.error {
        border-left-color: #eb0400; /* レッド */
      }
      .toast-content {
        flex-grow: 1;
        white-space: nowrap;
      }
      .close-btn {
        background: none;
        border: none;
        color: #adadb8;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        padding: 0 4px;
      }
      .close-btn:hover {
        color: #efeff1;
      }
    `;
    shadow.appendChild(style);

    // トーストコンテナ作成
    const toastContainer = document.createElement('div');
    toastContainer.className = `toast-container ${type}`;

    // メッセージコンテンツ作成 (XSS対策に textContent を徹底)
    const content = document.createElement('div');
    content.className = 'toast-content';
    content.textContent = message;
    toastContainer.appendChild(content);

    // 閉じるボタン作成 (保存中以外の場合)
    if (type !== 'saving') {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.textContent = '✕';
      closeBtn.onclick = () => this.removeToast();
      toastContainer.appendChild(closeBtn);
    }

    shadow.appendChild(toastContainer);

    // フェードインアニメーションのトリガー
    requestAnimationFrame(() => {
      toastContainer.classList.add('show');
    });

    // 5. 自動閉設定 (saving 以外は3秒後に自動クローズ)
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout);
      this.autoCloseTimeout = null;
    }

    if (type !== 'saving') {
      this.autoCloseTimeout = setTimeout(() => {
        toastContainer.classList.remove('show');
        setTimeout(() => this.removeToast(), 200);
      }, 3000);
    }
  }

  /**
   * トースト要素をDOMから削除する
   */
  private removeToast(): void {
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout);
      this.autoCloseTimeout = null;
    }
    if (this.hostElement) {
      this.hostElement.remove();
      this.hostElement = null;
    }
  }
}
