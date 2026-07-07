/**
 * Twitch の非公開 GraphQL API (gql.twitch.tv) への軽量クライアント
 * Twitch Web プレイヤー自身が使用している公開 Client-ID を利用して、
 * 進行中ライブ配信の「配信開始時刻」と「進行中アーカイブVODのID」を取得します。
 *
 * 注意: 非公開APIのため将来的に仕様変更される可能性があります。
 * 呼び出し側は必ず null 返却時のフォールバック処理を持つこと。
 */

import { isValidChannelLogin, extractChannelLoginFromPath } from '../../common/utils/channel';

export const TWITCH_GQL_ENDPOINT = 'https://gql.twitch.tv/gql';

/** Twitch Webサイト自身が使用している公開 Client-ID */
export const TWITCH_WEB_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

// 既存の呼び出し元 (adapter/テスト) との互換性のため再エクスポート
export { extractChannelLoginFromPath };

export interface TwitchStreamInfo {
  /** 配信開始時刻（ISO 8601形式）。取得できない場合は null */
  createdAt: string | null;
  /** 進行中アーカイブVODのID。アーカイブ未生成・非公開の場合は null */
  archiveVideoId: string | null;
}

/**
 * GQLレスポンスのJSONから配信情報を抽出する
 * @param json GQLレスポンスのパース済みJSON
 * @returns 配信情報。オフラインまたは不正な形式の場合は null
 */
export function parseStreamInfoResponse(json: unknown): TwitchStreamInfo | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const stream = (json as any)?.data?.user?.stream;
  if (!stream || typeof stream !== 'object') {
    return null;
  }

  const createdAt = typeof stream.createdAt === 'string' ? stream.createdAt : null;
  const archiveVideoId =
    stream.archiveVideo && typeof stream.archiveVideo.id === 'string'
      ? stream.archiveVideo.id
      : null;

  return { createdAt, archiveVideoId };
}

/**
 * 指定チャンネルの進行中ライブ配信情報をGQL APIから取得する
 * 失敗した場合（オフライン・ネットワークエラー・API仕様変更など）は null を返す
 * @param login チャンネルのログイン名
 * @param fetchFn テスト用に差し替え可能な fetch 実装
 */
export async function fetchStreamInfo(
  login: string,
  fetchFn: typeof fetch = fetch,
): Promise<TwitchStreamInfo | null> {
  // GQLクエリへの文字列埋め込みを行うため、ログイン名を厳格に検証（インジェクション対策）
  if (!isValidChannelLogin(login)) {
    return null;
  }

  try {
    const response = await fetchFn(TWITCH_GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_WEB_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { user(login: "${login}") { stream { createdAt archiveVideo { id } } } }`,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return parseStreamInfoResponse(json);
  } catch (error) {
    console.warn('Failed to fetch Twitch stream info via GQL:', error);
    return null;
  }
}
