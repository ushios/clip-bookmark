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
        <!-- ブックマークリスト -->
        <ul id="bookmark-list"></ul>
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
    // ポップアップ初期化を実行
    await initPopup();

    // 読み込み完了を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // ブックマークリストのチェック
    const list = document.getElementById('bookmark-list');
    expect(list?.children.length).toBe(2);
    
    // XSS対策：textContent を介して値が入っていること
    expect(list?.innerHTML).not.toContain('<script>');
    expect(list?.textContent).toContain('streamer_a');
    expect(list?.textContent).toContain('01:01:40');
    expect(list?.textContent).toContain('VOD Title A');

    // 設定フォームのチェック
    const toggle = document.getElementById('chat-observer-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    const triggerList = document.getElementById('trigger-words-list');
    expect(triggerList?.children.length).toBe(2);
    expect(triggerList?.textContent).toContain('!bm');
  });

  it('は項目をクリックした際、安全なURL検証を行い、タイムスタンプ付きURLで新規タブを開くこと', async () => {
    await initPopup();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const list = document.getElementById('bookmark-list');
    const firstItemLink = list?.querySelector('.bookmark-link') as HTMLElement;
    expect(firstItemLink).not.toBeNull();

    // クリックイベントを発火
    firstItemLink.click();

    // VOD(id: 1) の 3700秒 (1h01m40s) で chrome.tabs.create が呼ばれること
    // Twitch のタイムスタンプクエリは ?t=1h1m40s または秒数 ?t=3700s 等
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

    // 削除をクリック
    deleteBtn.click();

    // StorageManager が削除メソッドを呼んだこと
    expect(StorageManager.prototype.deleteBookmark).toHaveBeenCalledWith('1');

    // DOMから即座に消去されていること (最新件数が 1 になる)
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

    // 非同期の保存処理を待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // StorageManager の saveSettings が新設定で呼ばれていること
    expect(StorageManager.prototype.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerWords: ['!bm', '!bookmark', 'ここ！'],
      }),
    );

    // リストが更新されていること
    const triggerList = document.getElementById('trigger-words-list');
    expect(triggerList?.textContent).toContain('ここ！');
  });
});
