/**
 * "hh:mm:ss" または "mm:ss" 形式の時間文字列を秒数に変換する
 * @param timeStr 時間文字列 (例: "01:23:45", "45:12")
 * @returns 変換された秒数。不正な形式の場合は 0 を返す
 */
export function parseTimeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  
  const parts = timeStr.trim().split(':');
  if (parts.some((part) => isNaN(Number(part)))) {
    return 0;
  }

  let seconds = 0;
  if (parts.length === 3) {
    // hh:mm:ss
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secs = parseInt(parts[2], 10);
    seconds = hours * 3600 + minutes * 60 + secs;
  } else if (parts.length === 2) {
    // mm:ss
    const minutes = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    seconds = minutes * 60 + secs;
  }

  return seconds;
}

/**
 * 秒数を "hh:mm:ss" 形式の時間文字列にフォーマットする
 * @param seconds 秒数
 * @returns フォーマットされた時間文字列 (例: "01:23:45")
 */
export function formatSecondsToTimeString(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) {
    return '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

/**
 * 秒数をTwitchのタイムスタンプパラメータ形式 (XhYYmZZs) にフォーマットする
 * @param seconds 秒数
 * @returns フォーマットされたタイムスタンプ文字列 (例: "1h23m45s")
 */
export function formatSecondsToTwitchTimestamp(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) {
    return '0h00m00s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  return `${hours}h${pad(minutes)}m${pad(secs)}s`;
}
