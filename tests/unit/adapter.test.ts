import { describe, it, expect, beforeEach } from 'vitest';
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
  });

  it('はライブ配信中であっても HTML メタデータから進行中の VOD ID を検出して VOD URL を返すこと', async () => {
    // 進行中 VOD ID を含むダミーの script タグを作成
    const script = document.createElement('script');
    script.textContent = `window.__INITIAL_STATE__ = { "archiveVideo": { "id": "999888777" } };`;
    document.head.appendChild(script);

    // ライブ判定用のインジケーターをDOMに追加
    const liveIndicator = document.createElement('div');
    liveIndicator.setAttribute('data-a-target', 'player-live-indicator');
    document.body.appendChild(liveIndicator);

    const adapter = new TwitchAdapter();
    const isLive = await adapter.isLive();
    expect(isLive).toBe(true);

    const videoUrl = await adapter.getVideoUrl();
    expect(videoUrl).toBe('https://www.twitch.tv/videos/999888777');
  });
});
