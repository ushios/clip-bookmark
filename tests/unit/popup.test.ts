import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../../src/common/storage/storage.manager';
import { Bookmark } from '../../src/common/models/bookmark.model';
import { Settings } from '../../src/common/models/settings.model';
import { initPopup } from '../../src/popup/index';

describe('User Story 3: Popup UI & Settings', () => {
  let mockBookmarks: Bookmark[];
  let mockSettings: Settings;

  beforeEach(() => {
    // DOMを模擬リセット
    document.body.innerHTML = `
      <div class="container">
        <header>
          <h1>Clip Bookmark</h1>
        </header>

        <main>
          <div class="tabs">
            <button id="tab-history-btn" class="tab-btn active">履歴</button>
            <button id="tab-settings-btn" class="tab-btn">設定</button>
          </div>

          <section id="tab-history" class="tab-content">
            <div class="history-header">
              <h2>ブックマーク履歴</h2>
              <button id="clear-all-btn" class="danger-btn text-btn">全件削除</button>
            </div>
            <div class="filter-bar">
              <button id="filter-current-btn" class="filter-btn active">この動画のみ</button>
              <button id="filter-all-btn" class="filter-btn">すべて表示</button>
            </div>
            <div class="list-wrapper" style="height: 300px; overflow-y: scroll;">
              <ul id="bookmark-list"></ul>
              <div id="no-bookmarks" class="empty-state hidden">履歴がありません</div>
            </div>
          </section>

          <section id="tab-settings" class="tab-content hidden">
            <input type="checkbox" id="chat-observer-toggle" />
            <input type="text" id="trigger-word-input" />
            <button id="add-trigger-btn">追加</button>
            <ul id="trigger-words-list"></ul>
          </section>
        </main>
      </div>
    `;

    mockBookmarks = [
      {
        id: '1',
        platform: 'twitch',
        channelName: 'streamer_a',
        title: 'VOD Title A',
        videoUrl: 'https://twitch.tv/videos/12345',
        timestamp: new Date().toISOString(),
        relativeTime: 3700, // 1h01m40s
        isLive: false,
      },
      {
        id: '2',
        platform: 'twitch',
        channelName: 'streamer_b',
        title: 'Live Title B',
        videoUrl: 'https://twitch.tv/streamer_b',
        timestamp: new Date().toISOString(),
        relativeTime: 90, // 00:01:30
        isLive: true,
      },
    ];

    mockSettings = {
      triggerWords: ['!bm', '!bookmark'],
      enableChatObserver: true,
    };

    // StorageManagerの各モック定義
    vi.spyOn(StorageManager.prototype, 'getBookmarks').mockResolvedValue(mockBookmarks);
    vi.spyOn(StorageManager.prototype, 'getSettings').mockResolvedValue(mockSettings);
    vi.spyOn(StorageManager.prototype, 'saveBookmark').mockResolvedValue(undefined);
    vi.spyOn(StorageManager.prototype, 'deleteBookmark').mockResolvedValue(undefined);
    vi.spyOn(StorageManager.prototype, 'saveSettings').mockResolvedValue(undefined);

    vi.clearAllMocks();
  });

  it('は起動時にブックマーク履歴と設定を読み込み、UIに描画すること', async () => {
    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    expect(list?.children.length).toBe(2);

    expect(list?.innerHTML).not.toContain('<script>');
    expect(list?.textContent).toContain('streamer_a');
    expect(list?.textContent).toContain('01:01:40');
    expect(list?.textContent).toContain('VOD Title A');

    const toggle = document.getElementById('chat-observer-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    const triggerList = document.getElementById('trigger-words-list');
    expect(triggerList?.children.length).toBe(2);
    expect(triggerList?.textContent).toContain('!bm');
  });

  it('は項目をクリックした際、安全なURL遷移を行うこと', async () => {
    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    const firstItemLink = list?.querySelector('.bookmark-link') as HTMLElement;
    expect(firstItemLink).not.toBeNull();

    firstItemLink.click();

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://twitch.tv/videos/12345?t=1h01m40s',
    });
  });

  it('は削除ボタンをクリックし確認ダイアログで承認した際、StorageManagerから削除し、DOMからも即時消去すること', async () => {
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    const firstItem = list?.children[0] as HTMLElement;
    const deleteBtn = firstItem.querySelector('.delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();

    deleteBtn.click();

    expect(confirmMock).toHaveBeenCalled();
    expect(StorageManager.prototype.deleteBookmark).toHaveBeenCalledWith('1');
    expect(list?.children.length).toBe(1);
    expect(list?.textContent).not.toContain('VOD Title A');

    vi.unstubAllGlobals();
  });

  it('は削除の確認ダイアログでキャンセルした際、削除を行わないこと', async () => {
    const confirmMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirmMock);

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    const initialCount = list?.children.length;
    const firstItem = list?.children[0] as HTMLElement;
    const deleteBtn = firstItem.querySelector('.delete-btn') as HTMLElement;

    deleteBtn.click();

    expect(confirmMock).toHaveBeenCalled();
    expect(StorageManager.prototype.deleteBookmark).not.toHaveBeenCalled();
    expect(list?.children.length).toBe(initialCount);

    vi.unstubAllGlobals();
  });

  it('は新規のトリガーワードを設定した際、設定を保存しリストを更新すること', async () => {
    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const input = document.getElementById('trigger-word-input') as HTMLInputElement;
    const addBtn = document.getElementById('add-trigger-btn') as HTMLElement;

    input.value = 'ここ！';
    addBtn.click();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(StorageManager.prototype.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerWords: ['!bm', '!bookmark', 'ここ！'],
      }),
    );

    const triggerList = document.getElementById('trigger-words-list');
    expect(triggerList?.textContent).toContain('ここ！');
  });

  it('はスクロール時に無限スクロールにより次の50件を読み込むこと', async () => {
    // 70件のブックマークを作成してモック
    const largeBookmarks: Bookmark[] = [];
    for (let i = 1; i <= 70; i++) {
      largeBookmarks.push({
        id: `${i}`,
        platform: 'twitch',
        channelName: 'streamer_a',
        title: `VOD Title ${i}`,
        videoUrl: 'https://twitch.tv/videos/12345',
        timestamp: new Date().toISOString(),
        relativeTime: i * 10,
        isLive: false,
      });
    }
    vi.spyOn(StorageManager.prototype, 'getBookmarks').mockResolvedValue(largeBookmarks);

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    // 初期描画は上限 50 件
    expect(list?.children.length).toBe(50);

    const listWrapper = document.querySelector('.list-wrapper') as HTMLElement;
    // スクロール状態をシミュレート (最下部に達した状態)
    Object.defineProperty(listWrapper, 'scrollTop', { value: 200, configurable: true });
    Object.defineProperty(listWrapper, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(listWrapper, 'clientHeight', { value: 300, configurable: true });
    // 500 - 200 - 300 = 0 < 20 (最下部条件クリア)

    // スクロールイベントを発火
    const scrollEvent = new Event('scroll');
    listWrapper.dispatchEvent(scrollEvent);

    // 次の20件が追加で描画され、合計70件になること
    expect(list?.children.length).toBe(70);
  });

  it('はchrome.storage.onChangedイベントによりリアルタイム同期すること', async () => {
    // storage.onChangedのリスナー登録をキャプチャ
    let storageListener: Function | null = null;
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation((listener) => {
      storageListener = listener;
    });

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(storageListener).not.toBeNull();

    const list = document.getElementById('bookmark-list');
    expect(list?.children.length).toBe(2);

    // ストレージで3件目のブックマークが追加されたことをシミュレート
    const updatedBookmarks = [
      ...mockBookmarks,
      {
        id: '3',
        platform: 'twitch',
        channelName: 'streamer_c',
        title: 'Title C',
        videoUrl: 'https://twitch.tv/videos/9999',
        timestamp: new Date().toISOString(),
        relativeTime: 200,
        isLive: false,
      },
    ];

    if (storageListener) {
      storageListener(
        {
          bookmarks: {
            newValue: updatedBookmarks,
          },
        },
        'local',
      );
    }

    // 自動で再描画が走り、3件のブックマークがリストに並ぶこと
    expect(list?.children.length).toBe(3);
    expect(list?.textContent).toContain('streamer_c');
  });

  it('は現在のアクティブタブの動画URLに合致するブックマークのみをデフォルトで表示し、フィルタを切り替えることができること', async () => {
    // アクティブタブのURLをモック
    vi.mocked(chrome.tabs.query).mockImplementation((queryInfo, callback) => {
      if (callback) {
        callback([
          {
            id: 1,
            url: 'https://twitch.tv/videos/12345',
            active: true,
            windowId: 1,
          } as unknown as chrome.tabs.Tab,
        ]);
      }
    });

    // Content Scriptからのメッセージ応答（VOD設定）
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(
      (tabId, message, options, responseCallback) => {
        const callback = typeof options === 'function' ? options : responseCallback;
        if (callback) {
          callback({
            success: true,
            videoUrl: 'https://twitch.tv/videos/12345',
            title: 'VOD Title A',
            channelName: 'streamer_a',
            isLive: false,
          });
        }
      },
    );

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    const filterCurrentBtn = document.getElementById('filter-current-btn');
    const filterAllBtn = document.getElementById('filter-all-btn');

    // デフォルト（この動画のみ）では、URLが一致する「1」のブックマーク1件のみが表示されること
    expect(list?.children.length).toBe(1);
    expect(list?.textContent).toContain('streamer_a');
    expect(list?.textContent).not.toContain('streamer_b');

    // 「すべて表示」ボタンをクリック
    filterAllBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // すべてのブックマーク（2件）が表示されること
    expect(list?.children.length).toBe(2);
    expect(list?.textContent).toContain('streamer_a');
    expect(list?.textContent).toContain('streamer_b');

    // 「この動画のみ」ボタンをクリック
    filterCurrentBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 再度、一致する1件のみが表示されること
    expect(list?.children.length).toBe(1);
    expect(list?.textContent).toContain('streamer_a');
    expect(list?.textContent).not.toContain('streamer_b');
  });

  it('は生放送中において、チャンネル名と配信タイトルが一致するブックマークのみを表示すること', async () => {
    // アクティブタブのURLをモック
    vi.mocked(chrome.tabs.query).mockImplementation((queryInfo, callback) => {
      if (callback) {
        callback([
          {
            id: 1,
            url: 'https://twitch.tv/streamer_b',
            active: true,
            windowId: 1,
          } as unknown as chrome.tabs.Tab,
        ]);
      }
    });

    // Content Scriptからのメッセージ応答（生放送設定）
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(
      (tabId, message, options, responseCallback) => {
        const callback = typeof options === 'function' ? options : responseCallback;
        if (callback) {
          callback({
            success: true,
            videoUrl: 'https://twitch.tv/streamer_b',
            title: 'Live Title B',
            channelName: 'streamer_b',
            isLive: true,
          });
        }
      },
    );

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');

    // ライブ配信が一致する「2」のブックマーク1件のみが表示されること
    expect(list?.children.length).toBe(1);
    expect(list?.textContent).toContain('streamer_b');
    expect(list?.textContent).not.toContain('streamer_a');
  });

  describe('「この動画のみ」フィルタのチャンネルID(login)ベース判定', () => {
    it('はライブ視聴中、タイトルやチャンネル表示名が変わっていても同一チャンネルのライブブックマークを表示すること', async () => {
      // ライブ中に打刻したブックマーク（VOD URL保存済み・当時のタイトル・日本語表示名）
      const liveBookmarks: Bookmark[] = [
        {
          id: '10',
          platform: 'twitch',
          channelName: 'あたただよ', // 打刻時はDOMから日本語表示名が取れた
          channelLogin: 'atatadayo',
          title: '古いタイトル',
          videoUrl: 'https://www.twitch.tv/videos/555000111',
          timestamp: new Date().toISOString(),
          relativeTime: 300,
          isLive: true,
        },
        {
          id: '11',
          platform: 'twitch',
          channelName: 'other_channel',
          channelLogin: 'other_channel',
          title: '別チャンネルの配信',
          videoUrl: 'https://www.twitch.tv/other_channel',
          timestamp: new Date().toISOString(),
          relativeTime: 100,
          isLive: true,
        },
      ];
      vi.spyOn(StorageManager.prototype, 'getBookmarks').mockResolvedValue(liveBookmarks);

      vi.mocked(chrome.tabs.query).mockImplementation((queryInfo, callback) => {
        if (callback) {
          callback([
            {
              id: 1,
              url: 'https://www.twitch.tv/atatadayo',
              active: true,
              windowId: 1,
            } as unknown as chrome.tabs.Tab,
          ]);
        }
      });

      // ポップアップを開いた時点では、タイトルが変更され表示名も英語表記になっている
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(
        (tabId, message, options, responseCallback) => {
          const callback = typeof options === 'function' ? options : responseCallback;
          if (callback) {
            callback({
              success: true,
              videoUrl: 'https://www.twitch.tv/atatadayo',
              title: '新しいタイトル',
              channelName: 'Atatadayo',
              channelLogin: 'atatadayo',
              isLive: true,
            });
          }
        },
      );

      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      expect(list?.children.length).toBe(1);
      expect(list?.textContent).toContain('古いタイトル');
      expect(list?.textContent).not.toContain('別チャンネルの配信');
    });

    it('はレスポンスにchannelLoginがなくても、タブURLからログイン名を導出して判定できること', async () => {
      // 旧バージョンで保存されたchannelLoginなしのブックマーク（チャンネルURLのまま）
      const legacyBookmarks: Bookmark[] = [
        {
          id: '20',
          platform: 'twitch',
          channelName: 'あたただよ',
          title: '古いタイトル',
          videoUrl: 'https://www.twitch.tv/atatadayo',
          timestamp: new Date().toISOString(),
          relativeTime: 300,
          isLive: true,
        },
      ];
      vi.spyOn(StorageManager.prototype, 'getBookmarks').mockResolvedValue(legacyBookmarks);

      vi.mocked(chrome.tabs.query).mockImplementation((queryInfo, callback) => {
        if (callback) {
          callback([
            {
              id: 1,
              url: 'https://www.twitch.tv/atatadayo',
              active: true,
              windowId: 1,
            } as unknown as chrome.tabs.Tab,
          ]);
        }
      });

      vi.mocked(chrome.tabs.sendMessage).mockImplementation(
        (tabId, message, options, responseCallback) => {
          const callback = typeof options === 'function' ? options : responseCallback;
          if (callback) {
            callback({
              success: true,
              videoUrl: 'https://www.twitch.tv/videos/555000111', // GQLで進行中VOD URLが取れている
              title: '新しいタイトル',
              channelName: 'Atatadayo',
              isLive: true,
            });
          }
        },
      );

      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      expect(list?.children.length).toBe(1);
      expect(list?.textContent).toContain('古いタイトル');
    });

    it('はアーカイブ視聴中、ライブ中に打刻した同一VODのブックマーク(isLive=true)も表示すること', async () => {
      const archiveBookmarks: Bookmark[] = [
        {
          id: '30',
          platform: 'twitch',
          channelName: 'あたただよ',
          channelLogin: 'atatadayo',
          title: 'ライブ中に打刻',
          videoUrl: 'https://www.twitch.tv/videos/555000111',
          timestamp: new Date().toISOString(),
          relativeTime: 300,
          isLive: true, // ライブ中の打刻フラグ
        },
        {
          id: '31',
          platform: 'twitch',
          channelName: 'あたただよ',
          channelLogin: 'atatadayo',
          title: '別のVODで打刻',
          videoUrl: 'https://www.twitch.tv/videos/999999999',
          timestamp: new Date().toISOString(),
          relativeTime: 50,
          isLive: false,
        },
      ];
      vi.spyOn(StorageManager.prototype, 'getBookmarks').mockResolvedValue(archiveBookmarks);

      vi.mocked(chrome.tabs.query).mockImplementation((queryInfo, callback) => {
        if (callback) {
          callback([
            {
              id: 1,
              url: 'https://www.twitch.tv/videos/555000111',
              active: true,
              windowId: 1,
            } as unknown as chrome.tabs.Tab,
          ]);
        }
      });

      vi.mocked(chrome.tabs.sendMessage).mockImplementation(
        (tabId, message, options, responseCallback) => {
          const callback = typeof options === 'function' ? options : responseCallback;
          if (callback) {
            callback({
              success: true,
              videoUrl: 'https://www.twitch.tv/videos/555000111',
              title: 'アーカイブ',
              channelName: 'Atatadayo',
              channelLogin: 'atatadayo',
              isLive: false,
            });
          }
        },
      );

      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      expect(list?.children.length).toBe(1);
      expect(list?.textContent).toContain('ライブ中に打刻');
      expect(list?.textContent).not.toContain('別のVODで打刻');
    });
  });

  it('はブックマークのメモを表示し、インライン編集して保存できること', async () => {
    // 既存のブックマークにメモを設定 (readonly制約をキャストで回避)
    (mockBookmarks[0] as any).memo = 'テストのメモ';
    vi.spyOn(StorageManager.prototype, 'updateBookmarkMemo').mockResolvedValue(undefined);

    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // テスト間のタブモック干渉を防ぐため、「すべて表示」に切り替える
    const filterAllBtn = document.getElementById('filter-all-btn');
    filterAllBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    // IDが "1" のブックマーク要素を明示的に取得
    const firstItem = list?.querySelector('[data-id="1"]') as HTMLElement;
    expect(firstItem).not.toBeNull();

    // メモテキストが正しく描画されているか検証
    const memoSpan = firstItem.querySelector('.memo-text') as HTMLElement;
    expect(memoSpan).not.toBeNull();
    expect(memoSpan.textContent).toBe('テストのメモ');

    // 編集インプットが隠れていることを確認
    const memoInput = firstItem.querySelector('.memo-input') as HTMLInputElement;
    expect(memoInput.classList.contains('hidden')).toBe(true);

    // メモテキストをクリックして編集モードに切り替え
    memoSpan.click();
    expect(memoSpan.classList.contains('hidden')).toBe(true);
    expect(memoInput.classList.contains('hidden')).toBe(false);

    // インプットに新しい文字を入力し、Enterで確定
    memoInput.value = '更新されたメモ';
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    memoInput.dispatchEvent(enterEvent);

    // 編集モードが閉じ、StorageManagerに保存されたか検証
    expect(memoInput.classList.contains('hidden')).toBe(true);
    expect(memoSpan.classList.contains('hidden')).toBe(false);
    expect(memoSpan.textContent).toBe('更新されたメモ');
    expect(StorageManager.prototype.updateBookmarkMemo).toHaveBeenCalledWith('1', '更新されたメモ');
  });

  describe('タイムスタンプのクリップボードコピー (Issue #11)', () => {
    let writeTextMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
      });
    });

    it('はVODブックマークのコピーボタンでタイムスタンプ付き完全URLをコピーすること', async () => {
      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // テスト間のタブモック干渉を防ぐため、「すべて表示」に切り替える
      const filterAllBtn = document.getElementById('filter-all-btn');
      filterAllBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      const vodItem = list?.querySelector('[data-id="1"]') as HTMLElement;
      const copyBtn = vodItem.querySelector('.copy-btn') as HTMLElement;
      expect(copyBtn).not.toBeNull();

      copyBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // videoUrl が /videos/ 形式なので、タイムスタンプ付き完全URLがコピーされる
      expect(writeTextMock).toHaveBeenCalledWith('https://twitch.tv/videos/12345?t=1h01m40s');
    });

    it('はチャンネルURLしか持たないブックマークでは時間パラメータのみコピーすること', async () => {
      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 「すべて表示」に切り替えてライブブックマーク (id: 2) を表示
      const filterAllBtn = document.getElementById('filter-all-btn');
      filterAllBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      const liveItem = list?.querySelector('[data-id="2"]') as HTMLElement;
      const copyBtn = liveItem.querySelector('.copy-btn') as HTMLElement;
      expect(copyBtn).not.toBeNull();

      copyBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // relativeTime 90秒 → URL末尾にそのまま貼り付けられる ?t= 形式
      expect(writeTextMock).toHaveBeenCalledWith('?t=0h01m30s');
    });
  });

  describe('VOD IDの手動指定 (Issue #10)', () => {
    beforeEach(() => {
      vi.spyOn(StorageManager.prototype, 'updateBookmarkVideoUrl').mockResolvedValue(undefined);
    });

    it('はVOD未設定のブックマークに警告アイコンを表示すること', async () => {
      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const filterAllBtn = document.getElementById('filter-all-btn');
      filterAllBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      // id: 2 はチャンネルURL (VOD ID未設定) なので警告アイコンあり
      const liveItem = list?.querySelector('[data-id="2"]') as HTMLElement;
      expect(liveItem.querySelector('.vod-warning')).not.toBeNull();

      // id: 1 は /videos/ URLなので警告アイコンなし
      const vodItem = list?.querySelector('[data-id="1"]') as HTMLElement;
      expect(vodItem.querySelector('.vod-warning')).toBeNull();
    });

    it('は編集ボタンからVOD IDを入力して保存できること', async () => {
      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const filterAllBtn = document.getElementById('filter-all-btn');
      filterAllBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      const liveItem = list?.querySelector('[data-id="2"]') as HTMLElement;
      const editBtn = liveItem.querySelector('.vod-edit-btn') as HTMLElement;
      expect(editBtn).not.toBeNull();

      // 編集ボタンをクリックして入力欄を表示
      editBtn.click();
      const vodInput = liveItem.querySelector('.vod-input') as HTMLInputElement;
      expect(vodInput).not.toBeNull();
      expect(vodInput.classList.contains('hidden')).toBe(false);

      // VOD IDを入力してEnterで保存
      vodInput.value = '123456789';
      vodInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(StorageManager.prototype.updateBookmarkVideoUrl).toHaveBeenCalledWith(
        '2',
        'https://www.twitch.tv/videos/123456789',
      );
    });

    it('はVOD URLを貼り付けてもIDが抽出されて保存できること', async () => {
      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const filterAllBtn = document.getElementById('filter-all-btn');
      filterAllBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      const liveItem = list?.querySelector('[data-id="2"]') as HTMLElement;
      const editBtn = liveItem.querySelector('.vod-edit-btn') as HTMLElement;
      editBtn.click();

      const vodInput = liveItem.querySelector('.vod-input') as HTMLInputElement;
      vodInput.value = 'https://www.twitch.tv/videos/987654321?t=0h10m00s';
      vodInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(StorageManager.prototype.updateBookmarkVideoUrl).toHaveBeenCalledWith(
        '2',
        'https://www.twitch.tv/videos/987654321',
      );
    });

    it('は不正な入力の場合は保存せず拒否すること', async () => {
      const alertMock = vi.fn();
      vi.stubGlobal('alert', alertMock);

      await initPopup();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const filterAllBtn = document.getElementById('filter-all-btn');
      filterAllBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const list = document.getElementById('bookmark-list');
      const liveItem = list?.querySelector('[data-id="2"]') as HTMLElement;
      const editBtn = liveItem.querySelector('.vod-edit-btn') as HTMLElement;
      editBtn.click();

      const vodInput = liveItem.querySelector('.vod-input') as HTMLInputElement;
      vodInput.value = 'https://evil.com/videos/123';
      vodInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(StorageManager.prototype.updateBookmarkVideoUrl).not.toHaveBeenCalled();
      expect(alertMock).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
