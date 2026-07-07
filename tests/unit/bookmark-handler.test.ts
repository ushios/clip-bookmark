import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleExtensionMessage } from '../../src/background/handlers/bookmark.handler';
import { MESSAGE_ACTIONS } from '../../src/common/models/messages';

/** 正当な送信元を模したモック sender */
const validSender = {
  id: 'mock-extension-id',
  url: 'https://www.twitch.tv/shroud',
  tab: { id: 1 },
} as unknown as chrome.runtime.MessageSender;

function buildSaveMessage(payloadOverrides: Record<string, unknown> = {}) {
  return {
    action: MESSAGE_ACTIONS.SAVE_BOOKMARK,
    payload: {
      id: '1751700000000',
      platform: 'twitch',
      channelName: 'shroud',
      title: 'Test Stream',
      videoUrl: 'https://www.twitch.tv/videos/123456789',
      timestamp: '2026-07-05T10:00:00.000Z',
      relativeTime: 90,
      isLive: true,
      ...payloadOverrides,
    },
  };
}

describe('handleExtensionMessage (SAVE_BOOKMARK)', () => {
  beforeEach(() => {
    // ストレージモックを空の状態にリセット
    (chrome.storage.local.get as any).mockImplementation((_keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
      if (callback) callback({ bookmarks: [] });
      return Promise.resolve({ bookmarks: [] });
    });
  });

  it('はチャット打刻で渡されたメモをブックマークに保存すること', async () => {
    const sendResponse = vi.fn();
    await handleExtensionMessage(buildSaveMessage({ memo: '!bm ナイスプレイ' }) as any, validSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        bookmark: expect.objectContaining({ memo: expect.stringContaining('ナイスプレイ') }),
      }),
    );

    // ストレージにもメモ付きで書き込まれていること
    const setCalls = (chrome.storage.local.set as any).mock.calls;
    expect(setCalls.length).toBeGreaterThan(0);
    const savedBookmarks = setCalls[setCalls.length - 1][0].bookmarks;
    expect(savedBookmarks[0].memo).toContain('ナイスプレイ');
  });

  it('はメモが未指定の場合、memo フィールドなしで保存すること', async () => {
    const sendResponse = vi.fn();
    await handleExtensionMessage(buildSaveMessage() as any, validSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const setCalls = (chrome.storage.local.set as any).mock.calls;
    const savedBookmarks = setCalls[setCalls.length - 1][0].bookmarks;
    expect(savedBookmarks[0].memo).toBeUndefined();
  });

  it('はchannelLoginを小文字に正規化して保存すること', async () => {
    const sendResponse = vi.fn();
    await handleExtensionMessage(buildSaveMessage({ channelLogin: 'AtataDayo' }) as any, validSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const setCalls = (chrome.storage.local.set as any).mock.calls;
    const savedBookmarks = setCalls[setCalls.length - 1][0].bookmarks;
    expect(savedBookmarks[0].channelLogin).toBe('atatadayo');
  });

  it('は不正な形式のchannelLoginは保存しないこと', async () => {
    const sendResponse = vi.fn();
    await handleExtensionMessage(buildSaveMessage({ channelLogin: '不正な"ログイン' }) as any, validSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const setCalls = (chrome.storage.local.set as any).mock.calls;
    const savedBookmarks = setCalls[setCalls.length - 1][0].bookmarks;
    expect(savedBookmarks[0].channelLogin).toBeUndefined();
  });
});
