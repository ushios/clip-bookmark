import { Bookmark } from '../models/bookmark.model';
import { Settings } from '../models/settings.model';

/**
 * 拡張機能のデータを一元管理するストレージマネージャー（シングルトン）
 * chrome.storage.local (ブックマーク用) と chrome.storage.sync (設定用) をラップし、
 * FIFOローテーションなどのビジネスロジックを提供します。
 */
export class StorageManager {
  private static instance: StorageManager | null = null;
  private readonly MAX_BOOKMARKS = 1000;
  private readonly DEFAULT_SETTINGS: Settings = {
    triggerWords: ['!bm'],
    enableChatObserver: true,
  };

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
   * すべてのブックマークを取得
   */
  public async getBookmarks(): Promise<Bookmark[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['bookmarks'], (result) => {
        resolve(result.bookmarks || []);
      });
    });
  }

  /**
   * ブックマークを保存（1,000件のFIFOローテーション機能付き）
   */
  public async saveBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = await this.getBookmarks();
    
    // 重複保存を防ぐため、同一IDが既に存在する場合は更新、そうでない場合は追加
    const existingIndex = bookmarks.findIndex((b) => b.id === bookmark.id);
    if (existingIndex !== -1) {
      bookmarks[existingIndex] = bookmark;
    } else {
      bookmarks.push(bookmark);
    }

    // IDまたはタイムスタンプ順にソート（必要に応じて。基本は追加順）
    // 保存件数が最大数を超えた場合、古いもの（配列の先頭）から削除 (FIFO)
    while (bookmarks.length > this.MAX_BOOKMARKS) {
      bookmarks.shift();
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ bookmarks }, () => {
        resolve();
      });
    });
  }

  /**
   * 指定したIDのブックマークを削除
   */
  public async deleteBookmark(id: string): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const filtered = bookmarks.filter((b) => b.id !== id);

    return new Promise((resolve) => {
      chrome.storage.local.set({ bookmarks: filtered }, () => {
        resolve();
      });
    });
  }

  /**
   * すべてのブックマークをクリア
   */
  public async clearAllBookmarks(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ bookmarks: [] }, () => {
        resolve();
      });
    });
  }

  /**
   * 設定を取得（保存されていない場合はデフォルト値を返却）
   */
  public async getSettings(): Promise<Settings> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['settings'], (result) => {
        if (!result.settings) {
          resolve(this.DEFAULT_SETTINGS);
        } else {
          // デフォルト値とのマージを行い、欠落キーをカバー
          resolve({
            ...this.DEFAULT_SETTINGS,
            ...result.settings,
          });
        }
      });
    });
  }

  /**
   * 設定を保存
   */
  public async saveSettings(settings: Settings): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings }, () => {
        resolve();
      });
    });
  }
}
