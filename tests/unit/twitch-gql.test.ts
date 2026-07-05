import { describe, it, expect, vi } from 'vitest';
import {
  extractChannelLoginFromPath,
  parseStreamInfoResponse,
  fetchStreamInfo,
  TWITCH_GQL_ENDPOINT,
} from '../../src/content/platforms/twitch.gql';

describe('extractChannelLoginFromPath', () => {
  it('はチャンネルページのパスからログイン名を抽出できること', () => {
    expect(extractChannelLoginFromPath('/shroud')).toBe('shroud');
    expect(extractChannelLoginFromPath('/some_channel_123/')).toBe('some_channel_123');
  });

  it('はチャンネル以外の予約パスに対して null を返すこと', () => {
    expect(extractChannelLoginFromPath('/videos/123456')).toBeNull();
    expect(extractChannelLoginFromPath('/directory/gaming')).toBeNull();
    expect(extractChannelLoginFromPath('/search')).toBeNull();
    expect(extractChannelLoginFromPath('/')).toBeNull();
  });

  it('はログイン名として不正な文字を含むパスに対して null を返すこと', () => {
    expect(extractChannelLoginFromPath('/ch"annel')).toBeNull();
    expect(extractChannelLoginFromPath('/チャンネル')).toBeNull();
  });
});

describe('parseStreamInfoResponse', () => {
  it('は配信中のレスポンスから配信開始時刻とアーカイブVOD IDを抽出できること', () => {
    const json = {
      data: {
        user: {
          stream: {
            createdAt: '2026-07-05T10:00:00Z',
            archiveVideo: { id: '999888777' },
          },
        },
      },
    };
    expect(parseStreamInfoResponse(json)).toEqual({
      createdAt: '2026-07-05T10:00:00Z',
      archiveVideoId: '999888777',
    });
  });

  it('はアーカイブVODが未生成の場合、archiveVideoId を null として返すこと', () => {
    const json = {
      data: {
        user: {
          stream: {
            createdAt: '2026-07-05T10:00:00Z',
            archiveVideo: null,
          },
        },
      },
    };
    expect(parseStreamInfoResponse(json)).toEqual({
      createdAt: '2026-07-05T10:00:00Z',
      archiveVideoId: null,
    });
  });

  it('はオフライン（stream が null）の場合 null を返すこと', () => {
    const json = { data: { user: { stream: null } } };
    expect(parseStreamInfoResponse(json)).toBeNull();
  });

  it('は不正な形式のレスポンスに対して null を返すこと', () => {
    expect(parseStreamInfoResponse(null)).toBeNull();
    expect(parseStreamInfoResponse({})).toBeNull();
    expect(parseStreamInfoResponse({ data: { user: null } })).toBeNull();
  });
});

describe('fetchStreamInfo', () => {
  it('はGQLエンドポイントへ Client-ID ヘッダー付きでPOSTし、結果をパースして返すこと', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          user: {
            stream: {
              createdAt: '2026-07-05T10:00:00Z',
              archiveVideo: { id: '111222333' },
            },
          },
        },
      }),
    });

    const info = await fetchStreamInfo('shroud', fetchMock as unknown as typeof fetch);

    expect(info).toEqual({
      createdAt: '2026-07-05T10:00:00Z',
      archiveVideoId: '111222333',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(TWITCH_GQL_ENDPOINT);
    expect(options.method).toBe('POST');
    expect(options.headers['Client-ID']).toBeTruthy();
    expect(options.body).toContain('shroud');
  });

  it('は不正なログイン名を渡された場合、リクエストせずに null を返すこと (GQLインジェクション対策)', async () => {
    const fetchMock = vi.fn();
    const info = await fetchStreamInfo('bad"login', fetchMock as unknown as typeof fetch);
    expect(info).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('はネットワークエラー時に null を返すこと', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    const info = await fetchStreamInfo('shroud', fetchMock as unknown as typeof fetch);
    expect(info).toBeNull();
  });

  it('はHTTPエラーレスポンス時に null を返すこと', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const info = await fetchStreamInfo('shroud', fetchMock as unknown as typeof fetch);
    expect(info).toBeNull();
  });
});
