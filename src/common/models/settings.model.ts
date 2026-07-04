/**
 * 拡張機能の設定データモデルを定義するインターフェース
 */
export interface Settings {
  /** チャット監視のトリガーとなるキーワード一覧 */
  readonly triggerWords: string[];
  /** チャット監視（ChatObserver）の有効/無効フラグ */
  readonly enableChatObserver: boolean;
}
