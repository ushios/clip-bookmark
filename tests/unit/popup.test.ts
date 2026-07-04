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
      <div id="app">
        <!-- ブックマークリスト（無限スクロール用コンテナ含む） -->
        <div class="list-wrapper" style="height: 300px; overflow-y: scroll;">
          <ul id="bookmark-list"></ul>
        </div>
        <div id="no-bookmarks" class="hidden">履歴がありません</div>
        
        <!-- 設定フォーム -->
        <input type="text" id="trigger-word-input" />
        <button id="add-trigger-btn">追加</button>
        <ul id="trigger-words-list"></ul>
        <input type="checkbox" id="chat-observer-toggle" />
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

  it('は削除ボタンをクリックした際、StorageManagerから削除し、DOMからも即時消去すること', async () => {
    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    const firstItem = list?.children[0] as HTMLElement;
    const deleteBtn = firstItem.querySelector('.delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();

    deleteBtn.click();

    expect(StorageManager.prototype.deleteBookmark).toHaveBeenCalledWith('1');
    expect(list?.children.length).toBe(1);
    expect(list?.textContent).not.toContain('VOD Title A');
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
});
