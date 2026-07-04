/**
 * Service WorkerとContent Script、Popup間で送受信されるメッセージのアクション型定義
 */
export const MESSAGE_ACTIONS = {
  /** ブックマークのトリガー（ショートカットキー押下時など、再生位置取得要求） */
  TRIGGER_BOOKMARK: 'TRIGGER_BOOKMARK',
  /** ブックマークの保存指示（Service Workerへの保存要求） */
  SAVE_BOOKMARK: 'SAVE_BOOKMARK',
  /** 現在視聴中の動画/配信情報の取得要求（PopupからContent Scriptへの要求） */
  GET_VIDEO_INFO: 'GET_VIDEO_INFO',
} as const;

export type MessageAction = typeof MESSAGE_ACTIONS[keyof typeof MESSAGE_ACTIONS];

/**
 * 拡張機能内でやり取りされるメッセージの共通インターフェース
 */
export interface ExtensionMessage<T = unknown> {
  /** メッセージのアクションタイプ */
  readonly action: MessageAction;
  /** メッセージに付随するペイロードデータ */
  readonly payload?: T;
}
