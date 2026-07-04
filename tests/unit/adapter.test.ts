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
