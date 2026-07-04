import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MESSAGE_ACTIONS } from '../../src/common/models/messages';

// テスト対象のモジュールをモックするか、後で実装するため、まずはモックで関心の振る舞いを検証します。
// ここでは、各コンポーネントが接続されたときの連携テストおよび個別の振る舞いをテストします。

describe('User Story 1: Shortcut & Toast Notification', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Service Worker (Background) Shortcut Handling', () => {
    it('はショートカットキーが押された際、アクティブタブにTRIGGER_BOOKMARKメッセージを送ること', async () => {
      // background/index.ts の挙動をシミュレート
      // chrome.commands.onCommand.addListener に登録されたリスナーを取得
      let commandListener: ((command: string) => void) | null = null;
      vi.mocked(chrome.commands.onCommand.addListener).mockImplementation((listener) => {
        commandListener = listener;
      });

      // アクティブタブを返すように chrome.tabs.query をモック
      vi.mocked(chrome.tabs.query).mockImplementation((_queryInfo, callback) => {
        if (callback) {
          callback([{ id: 123, active: true } as chrome.tabs.Tab]);
        }
        return Promise.resolve([{ id: 123, active: true } as chrome.tabs.Tab]);
      });

      // background のエントリーポイントを動的インポート（リスナーの登録が行われる）
      await import('../../src/background/index');

      // リスナーが正しく設定されていることを確認
      expect(commandListener).not.toBeNull();

      // ショートカットキーイベントをトリガー
      if (commandListener) {
        commandListener('bookmark-trigger');
      }

      // chrome.tabs.sendMessage がアクティブタブ(123)に対して TRIGGER_BOOKMARK で送信されること
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          action: MESSAGE_ACTIONS.TRIGGER_BOOKMARK,
        }),
      );
    });
  });

  describe('CommandObserver (Content Script)', () => {
    it('はTRIGGER_BOOKMARKメッセージを受信した際、TwitchAdapterを呼び出して情報を抽出し、SAVE_BOOKMARKメッセージを送信すること', async () => {
      // まだ observer や adapter は未実装だが、テストファーストで型と参照を定義
      const { CommandObserver } = await import('../../src/content/observers/command.observer');
      const { PlatformAdapter } = await import('../../src/content/platforms/adapter.interface');

      // PlatformAdapter のモック
      const mockAdapter: PlatformAdapter = {
        getCurrentTime: vi.fn().mockResolvedValue(3600),
        getChannelName: vi.fn().mockResolvedValue('streamer_ninja'),
        getVideoTitle: vi.fn().mockResolvedValue('Epic Stream'),
        getVideoUrl: vi.fn().mockResolvedValue('https://twitch.tv/videos/12345'),
        isLive: vi.fn().mockResolvedValue(false),
        destroy: vi.fn(),
      };

      // メッセージリスナーをキャプチャ
      let messageListener: Function | null = null;
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((listener) => {
        messageListener = listener;
      });

      // Observerのインスタンス化
      const observer = new CommandObserver(mockAdapter);
      observer.start();

      expect(messageListener).not.toBeNull();

      // TRIGGER_BOOKMARK メッセージを受信したと想定
      if (messageListener) {
        await messageListener(
          { action: MESSAGE_ACTIONS.TRIGGER_BOOKMARK },
          { id: 'some-sender' },
          vi.fn(),
        );
      }

      // TwitchAdapter からデータを取得していること
      expect(mockAdapter.getCurrentTime).toHaveBeenCalled();
      expect(mockAdapter.getChannelName).toHaveBeenCalled();

      // chrome.runtime.sendMessage で SAVE_BOOKMARK が送信されること
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: MESSAGE_ACTIONS.SAVE_BOOKMARK,
          payload: expect.objectContaining({
            relativeTime: 3600,
            channelName: 'streamer_ninja',
            title: 'Epic Stream',
            videoUrl: 'https://twitch.tv/videos/12345',
            isLive: false,
          }),
        }),
      );
    });
  });

  describe('Toast Notification UI', () => {
    it('はchrome.storage.onChangedでbookmarksが更新された際、Shadow DOMを介して通知を表示すること', async () => {
      // トースト通知を表示させるビデオプレイヤーコンテナを用意
      const playerContainer = document.createElement('div');
      playerContainer.className = 'video-player__container';
      document.body.appendChild(playerContainer);

      // UIクラスをインポート
      const { ToastManager } = await import('../../src/content/ui/toast.manager');

      // storage.onChanged リスナーの登録をキャプチャ
      let storageListener: Function | null = null;
      vi.mocked(chrome.storage.onChanged.addListener).mockImplementation((listener) => {
        storageListener = listener;
      });

      // ToastManager を初期化
      const toastManager = new ToastManager();
      toastManager.start();

      expect(storageListener).not.toBeNull();

      // storage.onChanged で bookmarks の更新イベントをシミュレート
      if (storageListener) {
        storageListener(
          {
            bookmarks: {
              newValue: [
                {
                  id: '1',
                  platform: 'twitch',
                  channelName: 'streamer_ninja',
                  title: 'Epic Stream',
                  videoUrl: 'https://twitch.tv/videos/12345',
                  timestamp: new Date().toISOString(),
                  relativeTime: 100,
                  isLive: false,
                },
              ],
            },
          },
          'local',
        );
      }

      // ビデオプレイヤーコンテナ内に Shadow DOM を持つカスタム要素（トーストの親）が作成されていること
      const host = playerContainer.querySelector('.twitch-bookmark-toast-host');
      expect(host).not.toBeNull();
      expect(host?.shadowRoot).not.toBeNull();

      // Shadow DOM 内に「保存完了」または「100」などのテキストが含まれていること (XSS対策テキストであることを確認)
      const shadowRoot = host?.shadowRoot;
      const toastContent = shadowRoot?.querySelector('.toast-content');
      expect(toastContent).not.toBeNull();
      expect(toastContent?.textContent).toContain('00:01:40'); // 100秒 = 1分40秒
    });
  });
});
