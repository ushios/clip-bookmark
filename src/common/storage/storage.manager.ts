import { Bookmark } from '../models/bookmark.model';
import { Settings } from '../models/settings.model';

/**
 * 拡張機能のデータを一元管理するストレージマネージャー（シングルトン）
 * chrome.storage.local (ブックマーク用) と chrome.storage.sync (設定用) をラップし、
 * FIFOローテーションおよび非同期シリアライズキューによるRace Condition防止を提供します。
 */
export class StorageManager {
  private static instance: StorageManager | null = null;
  private readonly MAX_BOOKMARKS = 1000;
  private readonly DEFAULT_SETTINGS: Settings = {
    triggerWords: ['!bm'],
    enableChatObserver: true,
  };

  // Race Condition (Lost Update) 防止のための非同期シリアライズキュー
  private writeQueue: Promise<any> = Promise.resolve();

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * 書き込みタスクを直列キューに追加して実行する (Race Condition 防止)
   */
  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const nextPromise = this.writeQueue.then(task);
    // キューのPromiseチェーンを更新（エラーが起きても後続のタスクを実行できるようにcatchを追加）
    this.writeQueue = nextPromise.catch(() => {}).then(() => {});
    return nextPromise;
  }

  /**
   * Chrome Storageからデータを取得するジェネリックヘルパー (lastError監視付き)
   */
  private async getStorage<T>(area: 'local' | 'sync', keys: string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result as Record<string, T>);
        }
      });
    });
  }

  /**
   * Chrome Storageにデータを書き込むジェネリックヘルパー (lastError監視付き)
   */
  private async setStorage<T>(area: 'local' | 'sync', data: Record<string, T>): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage[area].set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * すべてのブックマークを取得
   */
  public async getBookmarks(): Promise<Bookmark[]> {
    try {
      const result = await this.getStorage<Bookmark[]>('local', ['bookmarks']);
      return result.bookmarks || [];
    } catch (error) {
      console.error('Failed to get bookmarks:', error);
      return [];
    }
  }

  /**
   * ブックマークを保存（1,000件のFIFOローテーションおよびRace Condition防止機能付き）
   */
  public async saveBookmark(bookmark: Bookmark): Promise<void> {
    return this.enqueue(async () => {
      const bookmarks = await this.getBookmarks();

      // 重複保存を防ぐため、同一IDが既に存在する場合は更新、そうでない場合は追加
      const existingIndex = bookmarks.findIndex((b) => b.id === bookmark.id);
      if (existingIndex !== -1) {
        bookmarks[existingIndex] = bookmark;
      } else {
        bookmarks.push(bookmark);
      }

      // 保存件数が最大数を超えた場合、古いもの（配列の先頭）から削除 (FIFO)
      while (bookmarks.length > this.MAX_BOOKMARKS) {
        bookmarks.shift();
      }

      await this.setStorage('local', { bookmarks });
    });
  }

  /**
   * 指定したIDのブックマークを削除
   */
  public async deleteBookmark(id: string): Promise<void> {
    return this.enqueue(async () => {
      const bookmarks = await this.getBookmarks();
      const filtered = bookmarks.filter((b) => b.id !== id);
      await this.setStorage('local', { bookmarks: filtered });
    });
  }

  /**
   * 指定した複数のIDのブックマークを一括削除
   */
  public async deleteBookmarks(ids: string[]): Promise<void> {
    return this.enqueue(async () => {
      const bookmarks = await this.getBookmarks();
      const filtered = bookmarks.filter((b) => !ids.includes(b.id));
      await this.setStorage('local', { bookmarks: filtered });
    });
  }

  /**
   * すべてのブックマークをクリア
   */
  public async clearAllBookmarks(): Promise<void> {
    return this.enqueue(async () => {
      await this.setStorage('local', { bookmarks: [] });
    });
  }

  /**
   * 指定したIDのブックマークのメモを更新
   */
  public async updateBookmarkMemo(id: string, memo: string): Promise<void> {
    return this.enqueue(async () => {
      const bookmarks = await this.getBookmarks();
      const updated = bookmarks.map((b) => {
        if (b.id === id) {
          return { ...b, memo: memo || undefined };
        }
        return b;
      });
      await this.setStorage('local', { bookmarks: updated });
    });
  }

  /**
   * 指定したIDのブックマークのvideoUrlを更新する（VOD IDの手動指定用）
   * VOD URLの指定はアーカイブへの紐付けを意味するため、isLive は false に更新される
   */
  public async updateBookmarkVideoUrl(id: string, videoUrl: string): Promise<void> {
    return this.enqueue(async () => {
      const bookmarks = await this.getBookmarks();
      const updated = bookmarks.map((b) => {
        if (b.id === id) {
          return { ...b, videoUrl, isLive: false };
        }
        return b;
      });
      await this.setStorage('local', { bookmarks: updated });
    });
  }

  /**
   * 設定を取得（保存されていない場合はデフォルト値を返却）
   */
  public async getSettings(): Promise<Settings> {
    try {
      const result = await this.getStorage<Settings>('sync', ['settings']);
      if (!result.settings) {
        return this.DEFAULT_SETTINGS;
      }
      // デフォルト値とのマージを行い、欠落キーをカバー
      return {
        ...this.DEFAULT_SETTINGS,
        ...result.settings,
      };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  }

  /**
   * 設定を保存
   */
  public async saveSettings(settings: Settings): Promise<void> {
    return this.enqueue(async () => {
      await this.setStorage('sync', { settings });
    });
  }
}
