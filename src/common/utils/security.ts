/**
 * セキュリティに関連するユーティリティ関数を提供するモジュール
 */

/**
 * 拡張機能で受信したメッセージの送信元(sender)を検証する
 * @param sender chrome.runtime.MessageSender オブジェクト
 * @returns 検証結果（正しければ true, 不正であれば false）
 */
export function validateMessageSender(sender: chrome.runtime.MessageSender): boolean {
  // 1. 拡張機能IDの検証 (自拡張機能からのメッセージであることを保証)
  if (!sender.id || sender.id !== chrome.runtime.id) {
    return false;
  }

  // 2. 送信元URLの検証 (Twitchオリジンであることを保証)
  if (!sender.url) {
    return false;
  }
  try {
    const url = new URL(sender.url);
    const hostname = url.hostname.toLowerCase();
    // twitch.tv または *.twitch.tv のみ許可
    if (hostname !== 'twitch.tv' && !hostname.endsWith('.twitch.tv')) {
      return false;
    }
  } catch (e) {
    return false; // 不正なURL形式
  }

  // 3. 送信元タブオブジェクトの存在検証 (Content Scriptから正しく送信されたことを保証)
  if (!sender.tab) {
    return false;
  }

  return true;
}

/**
 * 遷移先または保存対象のビデオURLを正規表現パターンで検証する
 * @param url 検証対象のURL文字列
 * @returns 許可されたURLパターンであれば true, そうでなければ false
 */
export function validateVideoUrl(url: string): boolean {
  if (!url) return false;

  // XSS対策：javascript: スキーマなどを排除
  if (url.trim().toLowerCase().startsWith('javascript:')) {
    return false;
  }

  // Twitchの配信またはVODの正規表現パターン (クエリパラメータやハッシュも含めて許容)
  const twitchUrlPattern =
    /^https:\/\/(?:[a-z0-9-]+\.)?twitch\.tv\/(?:videos\/\d+|[a-zA-Z0-9_]+)(?:\?.*)?(?:#.*)?$/i;

  return twitchUrlPattern.test(url);
}

/**
 * ユーザー入力やDOMから取得した文字列の制御文字を排除し、HTMLエスケープを行う（XSS対策）
 * @param str サニライズ対象の文字列
 * @param maxLength 切り捨てる最大文字数（オプション）
 * @returns サニライズ済みの安全な文字列
 */
export function sanitizeString(str: string, maxLength?: number): string {
  if (!str) return '';

  // 1. 制御文字 (ASCII 0x00-0x1F, 0x7F) の除去
  let cleanStr = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  // 2. 文字数制限が指定されている場合は切り捨て (Truncate)
  if (maxLength !== undefined && cleanStr.length > maxLength) {
    cleanStr = cleanStr.substring(0, maxLength);
  }

  // 3. HTML特殊文字のエスケープ
  return cleanStr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
