import { describe, it, expect } from 'vitest';
import {
  validateMessageSender,
  validateVideoUrl,
  sanitizeString,
} from '../../src/common/utils/security';

describe('Security Utilities', () => {
  describe('validateMessageSender', () => {
    it('は正しい拡張機能ID、Twitch Origin、およびTabオブジェクトを持つSenderを許可すること', () => {
      const validSender: chrome.runtime.MessageSender = {
        id: 'mock-extension-id',
        url: 'https://www.twitch.tv/streamer',
        tab: {
          id: 1,
          index: 0,
          windowId: 1,
          highlighted: false,
          active: true,
          selected: true,
          pinned: false,
          discarded: false,
          autoDiscardable: true,
          groupId: -1,
        } as chrome.tabs.Tab,
      };

      expect(validateMessageSender(validSender)).toBe(true);
    });

    it('は拡張機能IDが一致しないSenderを拒否すること', () => {
      const invalidSender: chrome.runtime.MessageSender = {
        id: 'wrong-extension-id',
        url: 'https://www.twitch.tv/streamer',
        tab: {} as chrome.tabs.Tab,
      };

      expect(validateMessageSender(invalidSender)).toBe(false);
    });

    it('はTwitchドメイン以外のSenderを拒否すること', () => {
      const invalidSender: chrome.runtime.MessageSender = {
        id: 'mock-extension-id',
        url: 'https://malicious.website.com/streamer',
        tab: {} as chrome.tabs.Tab,
      };

      expect(validateMessageSender(invalidSender)).toBe(false);
    });

    it('はTabオブジェクトが存在しないSenderを拒否すること', () => {
      const invalidSender: chrome.runtime.MessageSender = {
        id: 'mock-extension-id',
        url: 'https://www.twitch.tv/streamer',
        // tab が未定義
      };

      expect(validateMessageSender(invalidSender)).toBe(false);
    });
  });

  describe('validateVideoUrl', () => {
    it('は正しいTwitch VOD URLを許可すること', () => {
      expect(validateVideoUrl('https://www.twitch.tv/videos/123456789')).toBe(true);
      expect(validateVideoUrl('https://twitch.tv/videos/123456789?t=1h23m45s')).toBe(true);
    });

    it('は正しいTwitch ライブ配信URLを許可すること', () => {
      expect(validateVideoUrl('https://www.twitch.tv/ninja')).toBe(true);
      expect(validateVideoUrl('https://twitch.tv/ninja')).toBe(true);
    });

    it('はTwitch以外のURLを拒否すること', () => {
      expect(validateVideoUrl('https://www.youtube.com/watch?v=12345')).toBe(false);
      expect(validateVideoUrl('https://malicious.twitch.tv.attacker.com/videos/123')).toBe(false);
    });

    it('はjavascript:などの危険なURLを拒否すること', () => {
      expect(validateVideoUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('はHTML特殊文字をエスケープすること', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;';
      expect(sanitizeString(input)).toBe(expected);
    });

    it('は制御文字を除去すること', () => {
      const input = 'Hello\u0000World\u001f';
      const expected = 'HelloWorld';
      expect(sanitizeString(input)).toBe(expected);
    });

    it('は最大文字数制限が指定された場合、切り捨てること', () => {
      const input = 'abcdefghij';
      expect(sanitizeString(input, 5)).toBe('abcde');
    });
  });
});
