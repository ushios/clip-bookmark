import { Bookmark } from '../../common/models/bookmark.model';
import { ExtensionMessage, MESSAGE_ACTIONS } from '../../common/models/messages';
import { StorageManager } from '../../common/storage/storage.manager';
import { validateMessageSender, validateVideoUrl, sanitizeString } from '../../common/utils/security';

/**
 * Service Worker側でのメッセージ処理ハンドラー
 */
export async function handleExtensionMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): Promise<void> {
  // 送信元検証 (セキュリティ)
  if (!validateMessageSender(sender)) {
    console.error('Invalid message sender blocked:', sender);
    sendResponse({ success: false, error: 'Access denied: Invalid sender context.' });
    return;
  }

  // アクション別のハンドリング
  if (message.action === MESSAGE_ACTIONS.SAVE_BOOKMARK) {
    try {
      const payload = message.payload as Partial<Bookmark>;
      if (!payload) {
        throw new Error('Payload is missing');
      }

      // スキーマバリデーション & サニタイズ
      const relativeTime = payload.relativeTime;
      if (typeof relativeTime !== 'number' || relativeTime < 0 || relativeTime > 172800) {
        throw new Error('Invalid relativeTime value');
      }

      const videoUrl = payload.videoUrl || '';
      if (!validateVideoUrl(videoUrl)) {
        throw new Error('Invalid video URL format');
      }

      // 文字列フィールドのサニタイズ (最大255文字に制限)
      const channelName = sanitizeString(payload.channelName || 'Unknown Channel', 255);
      const title = sanitizeString(payload.title || 'Untitled Video', 255);
      const platform = sanitizeString(payload.platform || 'twitch', 50);
      const memo = payload.memo ? sanitizeString(payload.memo, 100) : undefined;

      // 保存するブックマークの構築
      const bookmark: Bookmark = {
        id: payload.id || Date.now().toString(),
        platform,
        channelName,
        title,
        videoUrl,
        timestamp: payload.timestamp || new Date().toISOString(),
        relativeTime,
        isLive: !!payload.isLive,
        ...(memo ? { memo } : {}),
      };

      // StorageManager シングルトンを用いて保存
      const storageManager = StorageManager.getInstance();
      await storageManager.saveBookmark(bookmark);

      // 保存完了バッジを拡張アイコン上に表示 (1.5秒間のみ)
      if (typeof chrome !== 'undefined' && chrome.action) {
        chrome.action.setBadgeText({ text: '＋1' });
        chrome.action.setBadgeBackgroundColor({ color: '#9146ff' }); // Twitchパープル
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, 1500);
      }

      sendResponse({ success: true, bookmark });
    } catch (error: any) {
      console.error('Failed to save bookmark:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else {
    sendResponse({ success: false, error: 'Unknown action' });
  }
}
