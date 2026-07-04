import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../../src/common/storage/storage.manager';
import { Bookmark } from '../../src/common/models/bookmark.model';
import { Settings } from '../../src/common/models/settings.model';

describe('StorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('はシングルトンインスタンスを提供すること', () => {
    const instance1 = StorageManager.getInstance();
    const instance2 = StorageManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  describe('Bookmarks Operations', () => {
    it('はブックマークを保存し、取得できること', async () => {
      const mockBookmark: Bookmark = {
        id: '1',
        platform: 'twitch',
        channelName: 'test_channel',
        title: 'test_title',
        videoUrl: 'https://twitch.tv/videos/1',
        timestamp: new Date().toISOString(),
        relativeTime: 100,
        isLive: false,
      };

      // chrome.storage.local.get のモックを設定 (初期状態は空配列)
      vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
        if (callback) callback({ bookmarks: [] });
        return Promise.resolve({ bookmarks: [] });
      });

      const manager = StorageManager.getInstance();
      await manager.saveBookmark(mockBookmark);

      // 保存時に chrome.storage.local.set が呼ばれることを確認
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarks: [mockBookmark],
        }),
        expect.any(Function),
      );
    });

    it('は1,000件を超えた場合に古いものから削除(FIFO)すること', async () => {
      const existingBookmarks: Bookmark[] = [];
      for (let i = 1; i <= 1000; i++) {
        existingBookmarks.push({
          id: `${i}`,
          platform: 'twitch',
          channelName: 'test',
          title: 'test',
          videoUrl: 'https://twitch.tv/videos/test',
          timestamp: new Date().toISOString(),
          relativeTime: i,
          isLive: false,
        });
      }

      // chrome.storage.local.get のモックを設定
      vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
        if (callback) callback({ bookmarks: existingBookmarks });
        return Promise.resolve({ bookmarks: existingBookmarks });
      });

      const newBookmark: Bookmark = {
        id: '1001',
        platform: 'twitch',
        channelName: 'test_new',
        title: 'test_new',
        videoUrl: 'https://twitch.tv/videos/new',
        timestamp: new Date().toISOString(),
        relativeTime: 1001,
        isLive: false,
      };

      const manager = StorageManager.getInstance();
      await manager.saveBookmark(newBookmark);

      // 最も古い bookmark (id: '1') が削除され、新しい bookmark (id: '1001') が追加されて1000件になっていること
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Function),
      );

      const setCallArgs = vi.mocked(chrome.storage.local.set).mock.calls[0][0] as { bookmarks: Bookmark[] };
      expect(setCallArgs.bookmarks.length).toBe(1000);
      expect(setCallArgs.bookmarks[0].id).toBe('2'); // 古い1件目が削除されている
      expect(setCallArgs.bookmarks[999].id).toBe('1001'); // 最新が末尾に追加されている
    });

    it('は指定したIDのブックマークのメモを更新できること', async () => {
      const existingBookmark: Bookmark = {
        id: '99',
        platform: 'twitch',
        channelName: 'test',
        title: 'test',
        videoUrl: 'https://twitch.tv/videos/99',
        timestamp: new Date().toISOString(),
        relativeTime: 99,
        isLive: false,
      };

      vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
        if (callback) callback({ bookmarks: [existingBookmark] });
        return Promise.resolve({ bookmarks: [existingBookmark] });
      });

      const manager = StorageManager.getInstance();
      await manager.updateBookmarkMemo('99', '新しいメモ');

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarks: [
            expect.objectContaining({
              id: '99',
              memo: '新しいメモ',
            }),
          ],
        }),
        expect.any(Function),
      );
    });
  });

  describe('Settings Operations', () => {
    it('は設定を保存し、取得できること', async () => {
      const mockSettings: Settings = {
        triggerWords: ['!bm', '!bookmark'],
        enableChatObserver: true,
      };

      // chrome.storage.sync.get のモックを設定
      vi.mocked(chrome.storage.sync.get).mockImplementation((_keys, callback) => {
        if (callback) callback({ settings: mockSettings });
        return Promise.resolve({ settings: mockSettings });
      });

      const manager = StorageManager.getInstance();
      const settings = await manager.getSettings();

      expect(settings).toEqual(mockSettings);

      await manager.saveSettings(mockSettings);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ settings: mockSettings }),
        expect.any(Function),
      );
    });

    it('は初期値が正しく設定されること', async () => {
      // 設定が未保存の場合
      vi.mocked(chrome.storage.sync.get).mockImplementation((_keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      });

      const manager = StorageManager.getInstance();
      const settings = await manager.getSettings();

      expect(settings.triggerWords).toContain('!bm');
      expect(settings.enableChatObserver).toBe(true);
    });
  });
});
