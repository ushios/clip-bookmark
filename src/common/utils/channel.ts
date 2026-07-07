/**
 * Twitchのチャンネルログイン名（配信者ID）に関するユーティリティ関数を提供するモジュール
 */

/** Twitchのログイン名として妥当な形式（英数字とアンダースコアのみ） */
const VALID_LOGIN_PATTERN = /^[a-zA-Z0-9_]{1,50}$/;

/** チャンネルページ以外の予約済み第1パスセグメント */
const RESERVED_PATHS = new Set([
  'videos',
  'directory',
  'search',
  'settings',
  'subscriptions',
  'wallet',
  'drops',
  'downloads',
  'jobs',
  'turbo',
  'p',
  'popout',
  'moderator',
  'embed',
]);

/**
 * チャンネルのログイン名として妥当な形式かどうかを検証する
 * @param login 検証対象の文字列
 */
export function isValidChannelLogin(login: string): boolean {
  return VALID_LOGIN_PATTERN.test(login);
}

/**
 * URLパス名からチャンネルのログイン名を抽出する
 * @param pathname window.location.pathname 相当の文字列
 * @returns ログイン名。チャンネルページでない場合は null
 */
export function extractChannelLoginFromPath(pathname: string): string | null {
  const firstSegment = pathname.replace(/^\//, '').split('/')[0];
  if (!firstSegment || RESERVED_PATHS.has(firstSegment.toLowerCase())) {
    return null;
  }
  if (!VALID_LOGIN_PATTERN.test(firstSegment)) {
    return null;
  }
  return firstSegment;
}

/**
 * URL文字列からチャンネルのログイン名を小文字で抽出する
 * @param url チャンネルURL (例: "https://www.twitch.tv/atatadayo")
 * @returns 小文字のログイン名。VOD URLや不正なURLの場合は null
 */
export function getChannelLoginFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    const login = extractChannelLoginFromPath(pathname);
    return login ? login.toLowerCase() : null;
  } catch (e) {
    return null;
  }
}
