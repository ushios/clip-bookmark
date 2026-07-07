/**
 * ブックマークのデータモデルを定義するインターフェース
 */
export interface Bookmark {
  /** ユニークなID（打刻時のタイムスタンプまたはUUID） */
  readonly id: string;
  /** 対象プラットフォーム（例: 'twitch', 'youtube' など） */
  readonly platform: 'twitch' | 'youtube' | string;
  /** 配信者またはチャンネルの名前 */
  readonly channelName: string;
  /** チャンネルのログイン名（URL由来の配信者ID、小文字）。旧バージョンで保存されたデータには存在しない */
  readonly channelLogin?: string;
  /** 配信または動画（VOD）のタイトル */
  readonly title: string;
  /** 動画（VOD）のベースURL、またはライブ配信のチャンネルURL */
  readonly videoUrl: string;
  /** 記録した絶対日時（ISO 8601形式の文字列） */
  readonly timestamp: string;
  /** 再生位置（動画開始時または配信開始時からの経過秒数、0以上 172,800秒[48時間]以内） */
  readonly relativeTime: number;
  /** ライブ配信中に記録されたかどうかのフラグ */
  readonly isLive: boolean;
  /** 将来的なプラットフォーム固有の拡張データ用メタデータ */
  readonly metadata?: Record<string, unknown>;
  /** ユーザーによる任意のコメント/メモ */
  readonly memo?: string;
}
