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
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = '!bm';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      // keydown イベントの発火 (IME変換中)
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
      } as KeyboardEventInit);
      textarea.dispatchEvent(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('はIME変換確定イベント(compositionstart)発火中のEnter入力を無視すること', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = '!bm';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      // compositionstart イベントを発火させて変換中状態にする
      const compStartEvent = new CompositionEvent('compositionstart');
      textarea.dispatchEvent(compStartEvent);

      // keydown イベントの発火 (isComposing は false だが isImeComposing が true)
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: false,
      } as KeyboardEventInit);
      textarea.dispatchEvent(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('はkeyCode === 229 (IME用仮想キーコード) のキー入力を無視すること', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = '!bm';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      // keydown イベントの発火 (keyCode = 229)
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 229,
        isComposing: false,
      } as any);
      textarea.dispatchEvent(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('は非変換時でトリガーワードを入力してEnterを押したとき、コールバックを呼び出すこと', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-a-target', 'chat-input');
      textarea.value = '!bm';
      document.body.appendChild(textarea);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: false,
      } as KeyboardEventInit);
      textarea.dispatchEvent(event);

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });
  });

  describe('MutationObserver (Chat Log Fallback)', () => {
    it('は自分以外の発言がチャットコンテナに追加された際、早期リターンすること', () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      const otherMessage = document.createElement('div');
      otherMessage.className = 'chat-line__message';
      otherMessage.innerHTML = `
        <span class="chat-author__display-name">ninja</span>
        <span class="message">!bm</span>
      `;
      chatContainer.appendChild(otherMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('は自分の発言がチャットコンテナに追加された際、トリガーワードを含んでいればコールバックを呼び出すこと', async () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

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

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });
  });

  describe('Settings Toggle', () => {
    it('は監視停止時にMutationObserverを完全に切断すること', () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      const observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);
      
      expect(observer.isObserving()).toBe(true);

      observer.destroy();
      expect(observer.isObserving()).toBe(false);

      const myMessage = document.createElement('div');
      myMessage.className = 'chat-line__message chat-line__message--self';
      myMessage.innerHTML = '<span class="message">!bm</span>';
      chatContainer.appendChild(myMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});
