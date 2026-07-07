import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BasePlatformAdapter } from '../../src/content/platforms/base.adapter';

// テスト用の具象クラス
class TestAdapter extends BasePlatformAdapter {
  public async getChannelName(): Promise<string> {
    return 'test_channel';
  }
  public async getVideoTitle(): Promise<string> {
    return 'test_title';
  }
  public async getVideoUrl(): Promise<string> {
    return 'https://twitch.tv/test_channel';
  }
  public async isLive(): Promise<boolean> {
    return false;
  }
}

describe('BasePlatformAdapter', () => {
  beforeEach(() => {
    // DOMをクリア
    document.body.innerHTML = '';
  });

  it('はvideo要素が存在する場合、現在再生位置を取得できること', async () => {
    // video要素をDOMに追加
    const video = document.createElement('video');
    video.currentTime = 123.45;
    document.body.appendChild(video);

    const adapter = new TestAdapter();
    const time = await adapter.getCurrentTime();
    expect(time).toBe(123); // 小数点以下は切り捨て
  });

  it('はvideo要素が存在しない場合、例外を投げること', async () => {
    const adapter = new TestAdapter();
    await expect(adapter.getCurrentTime()).rejects.toThrow('Video element not found');
  });
});

import { TwitchAdapter } from '../../src/content/platforms/twitch.adapter';

describe('TwitchAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // head内の既存のscriptタグをクリア
    const scripts = document.head.querySelectorAll('script');
    scripts.forEach(s => document.head.removeChild(s));
    // テスト用URLをTwitchのチャンネルページに設定 (happy-dom)
    (window as any).happyDOM?.setURL('https://www.twitch.tv/shroud');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** ライブ判定用インジケーターをDOMに追加するヘルパー */
  function addLiveIndicator(): void {
    const liveIndicator = document.createElement('div');
    liveIndicator.setAttribute('data-a-target', 'player-live-indicator');
    document.body.appendChild(liveIndicator);
  }

  /** GQL応答を返す fetch モックをグローバルに設定するヘルパー */
  function stubGqlFetch(stream: { createdAt?: string; archiveVideo?: { id: string } | null } | null): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { stream } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('はライブ配信中、GQL APIから進行中のアーカイブVOD IDを取得して VOD URL を返すこと', async () => {
    stubGqlFetch({ createdAt: '2026-07-05T10:00:00Z', archiveVideo: { id: '123456789' } });
    addLiveIndicator();

    const adapter = new TwitchAdapter();
    const videoUrl = await adapter.getVideoUrl();
    expect(videoUrl).toBe('https://www.twitch.tv/videos/123456789');
  });

  it('はGQL APIが失敗してもHTMLメタデータから進行中の VOD ID を検出して VOD URL を返すこと (フォールバック)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    // 進行中 VOD ID を含むダミーの script タグを作成
    const script = document.createElement('script');
    script.textContent = `window.__INITIAL_STATE__ = { "archiveVideo": { "id": "999888777" } };`;
    document.head.appendChild(script);

    addLiveIndicator();

    const adapter = new TwitchAdapter();
    const isLive = await adapter.isLive();
    expect(isLive).toBe(true);

    const videoUrl = await adapter.getVideoUrl();
    expect(videoUrl).toBe('https://www.twitch.tv/videos/999888777');
  });

  it('はライブ配信中、GQLの配信開始時刻から経過秒数を算出すること', async () => {
    const startedAt = new Date(Date.now() - 90 * 1000).toISOString(); // 90秒前に配信開始
    stubGqlFetch({ createdAt: startedAt, archiveVideo: { id: '123456789' } });
    addLiveIndicator();

    const adapter = new TwitchAdapter();
    const time = await adapter.getCurrentTime();
    expect(time).toBeGreaterThanOrEqual(90);
    expect(time).toBeLessThanOrEqual(92); // テスト実行時間の誤差を許容
  });

  it('はGQL応答を同一インスタンス内でキャッシュし、fetch を1回しか呼ばないこと', async () => {
    const startedAt = new Date(Date.now() - 90 * 1000).toISOString(); // 90秒前に配信開始
    const fetchMock = stubGqlFetch({ createdAt: startedAt, archiveVideo: { id: '123456789' } });
    addLiveIndicator();

    const adapter = new TwitchAdapter();
    await adapter.getCurrentTime();
    await adapter.getVideoUrl();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('はSPA遷移でチャンネルが変わった場合、キャッシュを使わず新しいチャンネルの情報を取得すること', async () => {
    const fetchMock = stubGqlFetch({ createdAt: '2026-07-05T00:00:00Z', archiveVideo: { id: '111111111' } });
    addLiveIndicator();

    const adapter = new TwitchAdapter();
    await adapter.getVideoUrl(); // shroud の情報を取得しキャッシュ

    // SPA遷移で別チャンネルへ移動 (content script は生き続ける)
    (window as any).happyDOM?.setURL('https://www.twitch.tv/another_channel');
    await adapter.getVideoUrl();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = fetchMock.mock.calls[1][1].body as string;
    expect(secondBody).toContain('another_channel');
  });

  describe('getChannelLogin', () => {
    it('はチャンネルページ（ライブ）でURLからログイン名を小文字で取得すること', async () => {
      (window as any).happyDOM?.setURL('https://www.twitch.tv/AtataDayo');

      const adapter = new TwitchAdapter();
      expect(await adapter.getChannelLogin()).toBe('atatadayo');
    });

    it('はVODページでチャンネルリンクのhrefからログイン名を取得すること', async () => {
      (window as any).happyDOM?.setURL('https://www.twitch.tv/videos/123456789');

      const channelLink = document.createElement('a');
      channelLink.setAttribute('data-a-target', 'user-channel-link');
      channelLink.setAttribute('href', '/atatadayo');
      document.body.appendChild(channelLink);

      const adapter = new TwitchAdapter();
      expect(await adapter.getChannelLogin()).toBe('atatadayo');
    });

    it('はVODページでチャンネルリンクが見つからない場合 null を返すこと', async () => {
      (window as any).happyDOM?.setURL('https://www.twitch.tv/videos/123456789');

      const adapter = new TwitchAdapter();
      expect(await adapter.getChannelLogin()).toBeNull();
    });
  });
});
