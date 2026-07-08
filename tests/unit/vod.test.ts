import { describe, it, expect } from 'vitest';
import { parseVodIdInput, buildVodUrl, buildJumpUrl } from '../../src/common/utils/vod';

describe('VOD Utilities', () => {
  describe('parseVodIdInput', () => {
    it('は数字のみのVOD IDをそのまま受け付けること', () => {
      expect(parseVodIdInput('123456789')).toBe('123456789');
      expect(parseVodIdInput('  123456789  ')).toBe('123456789');
    });

    it('はTwitchのVOD URLからIDを抽出できること', () => {
      expect(parseVodIdInput('https://www.twitch.tv/videos/123456789')).toBe('123456789');
      expect(parseVodIdInput('https://twitch.tv/videos/123456789')).toBe('123456789');
      expect(parseVodIdInput('https://m.twitch.tv/videos/123456789')).toBe('123456789');
    });

    it('はクエリパラメータ付きのVOD URLからIDを抽出できること', () => {
      expect(parseVodIdInput('https://www.twitch.tv/videos/123456789?t=1h23m45s')).toBe(
        '123456789',
      );
      expect(parseVodIdInput('https://www.twitch.tv/videos/123456789?t=0h01m05s&foo=bar')).toBe(
        '123456789',
      );
    });

    it('はスキームなしのVOD URLからIDを抽出できること', () => {
      expect(parseVodIdInput('www.twitch.tv/videos/123456789')).toBe('123456789');
      expect(parseVodIdInput('twitch.tv/videos/123456789')).toBe('123456789');
    });

    it('は不正な入力に対して null を返すこと', () => {
      expect(parseVodIdInput('')).toBeNull();
      expect(parseVodIdInput('abc')).toBeNull();
      expect(parseVodIdInput('123abc')).toBeNull();
      expect(parseVodIdInput('https://www.youtube.com/watch?v=123456789')).toBeNull();
      expect(parseVodIdInput('https://evil.com/videos/123456789')).toBeNull();
      expect(parseVodIdInput('https://www.twitch.tv/some_channel')).toBeNull();
      expect(parseVodIdInput('javascript:alert(1)')).toBeNull();
    });
  });

  describe('buildVodUrl', () => {
    it('はVOD IDから正規化されたVOD URLを生成すること', () => {
      expect(buildVodUrl('123456789')).toBe('https://www.twitch.tv/videos/123456789');
    });
  });

  describe('buildJumpUrl', () => {
    it('はVOD URLにタイムスタンプパラメータを付与すること', () => {
      expect(buildJumpUrl('https://www.twitch.tv/videos/12345', 3700)).toBe(
        'https://www.twitch.tv/videos/12345?t=1h01m40s',
      );
    });

    it('は既にクエリパラメータを持つURLには & で連結すること', () => {
      expect(buildJumpUrl('https://www.twitch.tv/videos/12345?foo=bar', 90)).toBe(
        'https://www.twitch.tv/videos/12345?foo=bar&t=0h01m30s',
      );
    });

    it('はVOD URLでない場合（チャンネルURL）はそのまま返すこと', () => {
      expect(buildJumpUrl('https://www.twitch.tv/some_channel', 3700)).toBe(
        'https://www.twitch.tv/some_channel',
      );
    });

    it('は相対時間が負の場合はタイムスタンプを付与しないこと', () => {
      expect(buildJumpUrl('https://www.twitch.tv/videos/12345', -1)).toBe(
        'https://www.twitch.tv/videos/12345',
      );
    });
  });
});
