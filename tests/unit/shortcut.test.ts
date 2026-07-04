import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MESSAGE_ACTIONS } from '../../src/common/models/messages';

describe('User Story 1: Shortcut & Toast Notification', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Service Worker (Background) Shortcut Handling', () => {
    it('はショートカットキーが押された際、アクティブタブにTRIGGER_BOOKMARKメッセージを送ること', async () => {
      let commandListener: ((command: string) => void) | null = null;
      vi.mocked(chrome.commands.onCommand.addListener).mockImplementation((listener) => {
        commandListener = listener;
      });

      vi.mocked(chrome.tabs.query).mockImplementation((_queryInfo, callback) => {
        if (callback) {
          callback([{ id: 123, active: true } as chrome.tabs.Tab]);
        }
        return Promise.resolve([{ id: 123, active: true } as chrome.tabs.Tab]);
      });

      await import('../../src/background/index');

      expect(commandListener).not.toBeNull();

      if (commandListener) {
        commandListener('bookmark-trigger');
      }

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          action: MESSAGE_ACTIONS.TRIGGER_BOOKMARK,
        }),
      );
    });
  });

  describe('CommandObserver (Content Script)', () => {
    it('は送信元IDが正しいTRIGGER_BOOKMARKメッセージを受信した際、コールバックを呼び出すこと', async () => {
      const { CommandObserver } = await import('../../src/content/observers/command.observer');

      let messageListener: Function | null = null;
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
        messageListener = listener;
      });

      const mockCallback = vi.fn();
      const observer = new CommandObserver(mockCallback);
      observer.start();

      expect(messageListener).not.toBeNull();

      if (messageListener) {
        await messageListener(
          { action: MESSAGE_ACTIONS.TRIGGER_BOOKMARK },
          { id: chrome.runtime.id }, // 正しい拡張機能IDを設定 (セキュリティパス)
          vi.fn(),
        );
      }

      // コールバックが呼び出されていること
      expect(mockCallback).toHaveBeenCalled();
    });

    it('は送信元IDが正しくないメッセージを受信した際、ブロックしてコールバックを呼び出さないこと', async () => {
      const { CommandObserver } = await import('../../src/content/observers/command.observer');

      let messageListener: Function | null = null;
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
        messageListener = listener;
      });

      const mockCallback = vi.fn();
      const observer = new CommandObserver(mockCallback);
      observer.start();

      if (messageListener) {
        await messageListener(
          { action: MESSAGE_ACTIONS.TRIGGER_BOOKMARK },
          { id: 'wrong-extension-id' }, // 不正な拡張機能ID
          vi.fn(),
        );
      }

      // コールバックが呼ばれないこと
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Toast Notification UI', () => {
    it('は直接showSuccessが呼び出された際、Shadow DOMを介して通知を表示すること', async () => {
      // トースト通知を表示させるビデオプレイヤーコンテナを用意
      const playerContainer = document.createElement('div');
      playerContainer.className = 'video-player__container';
      document.body.appendChild(playerContainer);

      // UIクラスをインポート
      const { ToastManager } = await import('../../src/content/ui/toast.manager');

      const toastManager = new ToastManager();
      toastManager.start();

      // 直接 showSuccess を呼び出す
      toastManager.showSuccess(100);

      // ビデオプレイヤーコンテナ内に Shadow DOM を持つカスタム要素（トーストの親）が作成されていること
      const host = playerContainer.querySelector('.twitch-bookmark-toast-host');
      expect(host).not.toBeNull();
      expect(host?.shadowRoot).not.toBeNull();

      // Shadow DOM 内にフォーマットされた時間が含まれていること (XSS対策テキストであることを確認)
      const shadowRoot = host?.shadowRoot;
      const toastContent = shadowRoot?.querySelector('.toast-content');
      expect(toastContent).not.toBeNull();
      expect(toastContent?.textContent).toContain('00:01:40'); // 100秒 = 1分40秒
    });
  });
});
