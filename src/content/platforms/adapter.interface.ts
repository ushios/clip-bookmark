/**
 * チャットメッセージのデータ構造
 */
export interface ChatMessage {
  /** 送信者名 */
  readonly sender: string;
  /** メッセージ本文 */
  readonly text: string;
}

/**
 * チャットメッセージ受信時のコールバック関数型
 */
export type ChatCallback = (message: ChatMessage) => void;

/**
 * 視聴プラットフォーム（Twitch、YouTubeなど）のビデオプレイヤーから情報を取得するためのアダプターインターフェース
 */
export interface PlatformAdapter {
  /**
   * 現在のビデオ再生位置（秒数）を取得する。
   * ライブ配信の場合は配信開始からの経過時間を取得する。
   */
  getCurrentTime(): Promise<number>;

  /**
   * 現在視聴中のチャンネル名または配信者名を取得する。
   */
  getChannelName(): Promise<string>;

  /**
   * 現在視聴中の動画または配信のタイトルを取得する。
   */
  getVideoTitle(): Promise<string>;

  /**
   * 現在の動画（VOD）のベースURL、またはライブ配信のチャンネルURLを取得する。
   */
  getVideoUrl(): Promise<string>;

  /**
   * 現在視聴中のコンテンツがライブ配信中かどうかを判定する。
   */
  isLive(): Promise<boolean>;

  /**
   * アダプターのリソース解放処理（イベントリスナーの解除など）
   */
  destroy(): void;
}

/**
 * チャット欄を監視するためのインターフェース
 */
export interface ChatObservable {
  /**
   * チャット監視を開始し、自身の発言をコールバックで通知する。
   * @param callback チャットメッセージを処理するコールバック
   */
  observeChat(callback: ChatCallback): void;
}
