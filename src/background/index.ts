import { MESSAGE_ACTIONS } from '../common/models/messages';
import { handleExtensionMessage } from './handlers/bookmark.handler';

/**
 * Service Worker (Background) のエントリーポイント
 * ショートカットキー(commands)の監視およびContent Scriptからのメッセージ中継を行います。
 */

// 1. キーボードショートカットコマンドのリスナー登録
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'bookmark-trigger') {
    // アクティブなタブを検索
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        // アクティブタブの Content Script に対して、現在再生位置の取得トリガーを送信
        chrome.tabs.sendMessage(activeTab.id, {
          action: MESSAGE_ACTIONS.TRIGGER_BOOKMARK,
        });
      }
    });
  }
});

// 2. メッセージ受信リスナー登録 (Content Script や Popup からの要求をハンドリング)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 非同期ハンドラを呼び出し、レスポンスが非同期であることを示すために true を返す
  handleExtensionMessage(message, sender, sendResponse);
  return true;
});
