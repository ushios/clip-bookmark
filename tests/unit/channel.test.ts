import { describe, it, expect } from 'vitest';
import {
  extractChannelLoginFromPath,
  getChannelLoginFromUrl,
  isValidChannelLogin,
} from '../../src/common/utils/channel';

describe('Channel Utilities', () => {
  describe('isValidChannelLogin', () => {
    it('は英数字とアンダースコアのログイン名を許可すること', () => {
      expect(isValidChannelLogin('atatadayo')).toBe(true);
      expect(isValidChannelLogin('some_channel_123')).toBe(true);
    });

    it('は不正な形式のログイン名を拒否すること', () => {
      expect(isValidChannelLogin('')).toBe(false);
      expect(isValidChannelLogin('チャンネル')).toBe(false);
      expect(isValidChannelLogin('ch"annel')).toBe(false);
    });
  });

  describe('extractChannelLoginFromPath', () => {
    it('はチャンネルページのパスからログイン名を抽出できること', () => {
      expect(extractChannelLoginFromPath('/atatadayo')).toBe('atatadayo');
      expect(extractChannelLoginFromPath('/some_channel_123/')).toBe('some_channel_123');
    });

    it('はチャンネル以外の予約パスに対して null を返すこと', () => {
      expect(extractChannelLoginFromPath('/videos/123456')).toBeNull();
      expect(extractChannelLoginFromPath('/directory/gaming')).toBeNull();
      expect(extractChannelLoginFromPath('/')).toBeNull();
    });
  });

  describe('getChannelLoginFromUrl', () => {
    it('はチャンネルURLからログイン名を小文字で抽出できること', () => {
      expect(getChannelLoginFromUrl('https://www.twitch.tv/atatadayo')).toBe('atatadayo');
      expect(getChannelLoginFromUrl('https://twitch.tv/AtataDayo')).toBe('atatadayo');
      expect(getChannelLoginFromUrl('https://www.twitch.tv/atatadayo?foo=bar')).toBe('atatadayo');
    });

    it('はVOD URLや予約パスに対して null を返すこと', () => {
      expect(getChannelLoginFromUrl('https://www.twitch.tv/videos/123456789')).toBeNull();
      expect(getChannelLoginFromUrl('https://www.twitch.tv/directory/gaming')).toBeNull();
    });

    it('は不正なURL文字列に対して null を返すこと', () => {
      expect(getChannelLoginFromUrl('')).toBeNull();
      expect(getChannelLoginFromUrl('not a url')).toBeNull();
    });
  });
});
