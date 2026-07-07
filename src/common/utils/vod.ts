import { formatSecondsToTwitchTimestamp } from './time';

/**
 * TwitchのアーカイブVOD（動画）に関連するユーティリティ関数を提供するモジュール
 */

/**
 * ユーザー入力からVOD IDを抽出する
 * 数字のみのID、またはTwitchのVOD URL (twitch.tv/videos/{id}) の両方を受け付ける
 * @param input ユーザーが入力した文字列 (例: "123456789", "https://www.twitch.tv/videos/123456789?t=1h2m3s")
 * @returns 抽出されたVOD ID。不正な入力の場合は null を返す
 */
export function parseVodIdInput(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  // パターン1: 数字のみのVOD ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // パターン2: TwitchのVOD URL (スキームなしも許容)
  const urlMatch = trimmed.match(
    /^(?:https:\/\/)?(?:[a-z0-9-]+\.)?twitch\.tv\/videos\/(\d+)(?:[?#].*)?$/i,
  );
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return null;
}

/**
 * VOD IDから正規化されたVOD URLを生成する
 * @param videoId VOD ID (数字のみ)
 * @returns VOD URL (例: "https://www.twitch.tv/videos/123456789")
 */
export function buildVodUrl(videoId: string): string {
  return `https://www.twitch.tv/videos/${videoId}`;
}

/**
 * ブックマークのジャンプ先URLを生成する
 * videoUrl がVOD URL (/videos/ を含む) の場合はタイムスタンプパラメータを付与し、
 * チャンネルURLの場合はそのまま返す
 * @param videoUrl ブックマークに保存されたURL
 * @param relativeTime 動画先頭（または配信開始）からの相対秒数
 * @returns ジャンプ先URL
 */
export function buildJumpUrl(videoUrl: string, relativeTime: number): string {
  if (videoUrl.includes('/videos/') && relativeTime >= 0) {
    const timestampParam = `t=${formatSecondsToTwitchTimestamp(relativeTime)}`;
    const separator = videoUrl.includes('?') ? '&' : '?';
    return `${videoUrl}${separator}${timestampParam}`;
  }
  return videoUrl;
}
