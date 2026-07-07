import { describe, it, expect } from 'vitest';
import {
  parseTimeStringToSeconds,
  formatSecondsToTimeString,
  formatSecondsToTwitchTimestamp,
} from '../../src/common/utils/time';

describe('Time Utilities', () => {
  describe('parseTimeStringToSeconds', () => {
    it('は hh:mm:ss 形式を秒数にパースできること', () => {
      expect(parseTimeStringToSeconds('01:23:45')).toBe(5025);
      expect(parseTimeStringToSeconds('00:01:30')).toBe(90);
    });

    it('は mm:ss 形式を秒数にパースできること', () => {
      expect(parseTimeStringToSeconds('45:12')).toBe(2712);
      expect(parseTimeStringToSeconds('01:05')).toBe(65);
    });

    it('は不正な形式に対して 0 を返すか例外を投げないこと', () => {
      expect(parseTimeStringToSeconds('invalid')).toBe(0);
      expect(parseTimeStringToSeconds('')).toBe(0);
    });
  });

  describe('formatSecondsToTimeString', () => {
    it('は秒数を hh:mm:ss 形式に変換できること', () => {
      expect(formatSecondsToTimeString(5025)).toBe('01:23:45');
      expect(formatSecondsToTimeString(90)).toBe('00:01:30');
      expect(formatSecondsToTimeString(5)).toBe('00:00:05');
    });

    it('は 0 または負の値に対して 00:00:00 を返すこと', () => {
      expect(formatSecondsToTimeString(0)).toBe('00:00:00');
      expect(formatSecondsToTimeString(-10)).toBe('00:00:00');
    });
  });

  describe('formatSecondsToTwitchTimestamp', () => {
    it('は秒数をTwitchの t= パラメータ形式 (XhYYmZZs) に変換できること', () => {
      expect(formatSecondsToTwitchTimestamp(3700)).toBe('1h01m40s');
      expect(formatSecondsToTwitchTimestamp(90)).toBe('0h01m30s');
      expect(formatSecondsToTwitchTimestamp(5025)).toBe('1h23m45s');
    });

    it('は 0 または負の値に対して 0h00m00s を返すこと', () => {
      expect(formatSecondsToTwitchTimestamp(0)).toBe('0h00m00s');
      expect(formatSecondsToTwitchTimestamp(-10)).toBe('0h00m00s');
    });
  });
});
