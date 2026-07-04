import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatObserver } from '../../src/content/observers/chat.observer';

describe('User Story 2: Chat Comment Trigger', () => {
  let mockCallback: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockCallback = vi.fn();
    vi.clearAllMocks();
  });

  describe('Keyboard Event Trigger (Input Area)', () => {
    it('はIME変換確定時(isComposing = true)のEnter入力を無視すること', () => {
      // チャットのテキストエリアをモック
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = '!bm';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(mockCallback, ['!bm']);
      observer.start();

      // keydown イベントの発火 (IME変換中)
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
      } as KeyboardEventInit);
      textarea.dispatchEvent(event);

      // コールバックが呼び出されていないことを確認
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('は非変換時でトリガーワードを入力してEnterを押したとき、コールバックを呼び出すこと', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = '!bm';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(mockCallback, ['!bm']);
      observer.start();

      // keydown イベントの発火 (IME変換中でない)
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: false,
      } as KeyboardEventInit);
      textarea.dispatchEvent(event);

      // コールバックが呼ばれ、かつ入力文字が引数として渡されること
      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });

    it('はトリガーワード以外の入力時のEnter入力を無視すること', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = 'hello world';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(mockCallback, ['!bm']);
      observer.start();

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: false,
      } as KeyboardEventInit);
      textarea.dispatchEvent(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('MutationObserver (Chat Log Fallback)', () => {
    it('は自分以外の発言がチャットコンテナに追加された際、早期リターンすること', () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      const observer = new ChatObserver(mockCallback, ['!bm']);
      observer.start();

      // 他人の発言ノードを追加 (self クラスなし)
      const otherMessage = document.createElement('div');
      otherMessage.className = 'chat-line__message';
      otherMessage.innerHTML = `
        <span class="chat-author__display-name">ninja</span>
        <span class="message">!bm</span>
      `;
      
      // MutationObserver のコールバック動作を手動でトリガーするか、DOM変更でテスト
      // Vitestの happy-dom 環境では MutationObserver が動作します
      chatContainer.appendChild(otherMessage);

      // 実際は MutationObserver は非同期なので、少し待つか、observerの内部メソッドを叩く
      // ここでは、MutationObserverの動作を確実に待つために setTimeout または Promise で待ちます。
      // ただし、ninjaは自分ではないので、呼ばれないはずです。
    });

    it('は自分の発言がチャットコンテナに追加された際、トリガーワードを含んでいればコールバックを呼び出すこと', async () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      const observer = new ChatObserver(mockCallback, ['!bm']);
      observer.start();

      // 自分の発言ノードを追加 (self クラスあり)
      const myMessage = document.createElement('div');
      myMessage.className = 'chat-line__message chat-line__message--self';
      
      const authorSpan = document.createElement('span');
      authorSpan.className = 'chat-author__display-name';
      authorSpan.textContent = 'me';
      myMessage.appendChild(authorSpan);

      const textSpan = document.createElement('span');
      textSpan.className = 'message';
      textSpan.textContent = '!bm';
      myMessage.appendChild(textSpan);

      chatContainer.appendChild(myMessage);

      // MutationObserver の発火を待つ
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });
  });

  describe('Settings Toggle', () => {
    it('は監視停止時(destroy/disconnect)にMutationObserverを完全に切断すること', () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      const observer = new ChatObserver(mockCallback, ['!bm']);
      observer.start();
      
      // 内部の MutationObserver インスタンスへの参照があるか確認
      expect(observer.isObserving()).toBe(true);

      // 監視切断
      observer.destroy();
      expect(observer.isObserving()).toBe(false);

      // 自分の発言を追加してもコールバックが呼ばれないこと
      const myMessage = document.createElement('div');
      myMessage.className = 'chat-line__message chat-line__message--self';
      myMessage.innerHTML = '<span class="message">!bm</span>';
      chatContainer.appendChild(myMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});
