import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatObserver, extractLoginFromCookie } from '../../src/content/observers/chat.observer';

describe('extractLoginFromCookie', () => {
  it('は twilight-user Cookie (JSON) からログイン名を抽出できること', () => {
    const cookie =
      'twilight-user=' +
      encodeURIComponent(JSON.stringify({ authToken: 'xxx', login: 'Ushio_S', id: '123' }));
    expect(extractLoginFromCookie(cookie)).toBe('ushio_s');
  });

  it('は login Cookie からログイン名を抽出できること', () => {
    expect(extractLoginFromCookie('foo=1; login=ushio_s; bar=2')).toBe('ushio_s');
  });

  it('はログインしていない場合 null を返すこと', () => {
    expect(extractLoginFromCookie('')).toBeNull();
    expect(extractLoginFromCookie('foo=1; bar=2')).toBeNull();
  });

  it('は不正な形式のCookie値に対して null を返すこと', () => {
    expect(extractLoginFromCookie('twilight-user=not-json')).toBeNull();
    expect(extractLoginFromCookie('login=bad%20name!')).toBeNull();
  });
});

describe('User Story 2: Chat Comment Trigger', () => {
  let mockCallback: any;
  let observer: ChatObserver | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockCallback = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // document レベルの委譲リスナーがテスト間でリークしないように破棄
    observer?.destroy();
    observer = null;
  });

  /** textarea 形式のチャット入力欄を作成するヘルパー (旧Twitch UI) */
  function createTextareaInput(value: string): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-a-target', 'chat-input');
    textarea.value = value;
    document.body.appendChild(textarea);
    return textarea;
  }

  /** contenteditable div 形式のチャット入力欄を作成するヘルパー (現行Twitch UI / Slateエディタ) */
  function createContentEditableInput(text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.setAttribute('data-a-target', 'chat-input');
    div.setAttribute('contenteditable', 'true');
    div.className = 'chat-wysiwyg-input__editor';
    div.textContent = text;
    document.body.appendChild(div);
    return div;
  }

  function pressEnter(target: HTMLElement, init: KeyboardEventInit = {}): void {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: false,
      bubbles: true,
      ...init,
    } as KeyboardEventInit);
    target.dispatchEvent(event);
  }

  describe('Keyboard Event Trigger (Input Area)', () => {
    it('はIME変換確定時(isComposing = true)のEnter入力を無視すること', () => {
      const textarea = createTextareaInput('!bm');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(textarea, { isComposing: true } as KeyboardEventInit);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('はIME変換確定イベント(compositionstart)発火中のEnter入力を無視すること', () => {
      const textarea = createTextareaInput('!bm');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      // compositionstart イベントを発火させて変換中状態にする
      const compStartEvent = new CompositionEvent('compositionstart', { bubbles: true });
      textarea.dispatchEvent(compStartEvent);

      pressEnter(textarea);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('はkeyCode === 229 (IME用仮想キーコード) のキー入力を無視すること', () => {
      const textarea = createTextareaInput('!bm');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(textarea, { keyCode: 229 } as any);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('は非変換時でトリガーワードを入力してEnterを押したとき、コールバックを呼び出すこと (textarea形式)', () => {
      const textarea = createTextareaInput('!bm');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(textarea);

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });

    it('はcontenteditable形式の入力欄(現行Twitch UI)でもトリガーを検知すること', () => {
      const editor = createContentEditableInput('!bm');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(editor);

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });

    it('は監視開始より後からDOMに追加された入力欄でもトリガーを検知すること (SPA遅延マウント対応)', () => {
      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      // observeChat の後に入力欄がマウントされる
      const editor = createContentEditableInput('!bm');
      pressEnter(editor);

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });

    it('はトリガーワードに続けてコメントを入力した場合もトリガーを検知し、全文をコールバックに渡すこと', () => {
      const editor = createContentEditableInput('!bm ナイスプレイ');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(editor);

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm ナイスプレイ' });
    });

    it('はトリガーワードで始まるだけの別単語 (!bmx など) には反応しないこと', () => {
      const editor = createContentEditableInput('!bmx test');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(editor);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('はチャット入力欄以外の要素でのEnter入力には反応しないこと', () => {
      const otherInput = document.createElement('textarea');
      otherInput.value = '!bm';
      // data-a-target="chat-input" を持たない検索ボックスなど
      otherInput.setAttribute('data-a-target', 'search-input');
      document.body.appendChild(otherInput);

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      pressEnter(otherInput);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('MutationObserver (Chat Log Fallback)', () => {
    afterEach(() => {
      // テストで設定したログインCookieをクリア
      document.cookie = 'twilight-user=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    });

    /** 現行Twitch DOMを模したチャット行を作成するヘルパー */
    function createChatLine(user: string, text: string): HTMLDivElement {
      const line = document.createElement('div');
      line.className = 'chat-line__message';
      line.setAttribute('data-a-target', 'chat-line-message');
      line.setAttribute('data-a-user', user);
      const textSpan = document.createElement('span');
      textSpan.setAttribute('data-a-target', 'chat-message-text');
      textSpan.textContent = text;
      line.appendChild(textSpan);
      return line;
    }

    it('は自分のアカウントの発言 (data-a-user がログイン名と一致) を検知すること (スマホなど別デバイス発のコメント対応)', async () => {
      document.cookie = 'twilight-user=' + encodeURIComponent(JSON.stringify({ login: 'Ushio_S' }));

      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__message-container';
      document.body.appendChild(chatContainer);

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      // スマホから送信されたコメントがPCのチャット欄に描画されるのを模倣
      chatContainer.appendChild(createChatLine('ushio_s', '!bm ナイス'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm ナイス' });
    });

    it('は他人の発言 (data-a-user がログイン名と不一致) には反応しないこと', async () => {
      document.cookie = 'twilight-user=' + encodeURIComponent(JSON.stringify({ login: 'ushio_s' }));

      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__message-container';
      document.body.appendChild(chatContainer);

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      chatContainer.appendChild(createChatLine('someone_else', '!bm'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('は現行のチャットコンテナ (chat-scrollable-area__message-container) を監視できること', async () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__message-container';
      document.body.appendChild(chatContainer);

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);

      const myMessage = document.createElement('div');
      myMessage.className = 'chat-line__message chat-line__message--self';
      myMessage.innerHTML = '<span class="message">!bm</span>';
      chatContainer.appendChild(myMessage);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCallback).toHaveBeenCalledWith({ sender: 'self', text: '!bm' });
    });

    it('は自分以外の発言がチャットコンテナに追加された際、早期リターンすること', () => {
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-scrollable-area__list-container';
      document.body.appendChild(chatContainer);

      observer = new ChatObserver(undefined, ['!bm']);
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

      observer = new ChatObserver(undefined, ['!bm']);
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

      observer = new ChatObserver(undefined, ['!bm']);
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

    it('は監視停止後、入力欄のEnter入力にも反応しないこと', () => {
      const editor = createContentEditableInput('!bm');

      observer = new ChatObserver(undefined, ['!bm']);
      observer.observeChat(mockCallback);
      observer.destroy();

      pressEnter(editor);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});
