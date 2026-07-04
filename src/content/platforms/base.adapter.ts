import { PlatformAdapter } from './adapter.interface';

/**
 * 異なる動画プラットフォームで共通する操作（HTML5 <video> 要素の制御など）をカプセル化した抽象クラス
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  /**
   * 現在の動画要素から再生時間（経過時間）を秒単位で取得する。
   * 小数点以下は切り捨てる。
   * @throws video要素が見つからない場合に例外を投げる
   */
  public async getCurrentTime(): Promise<number> {
    const videoElement = this.getVideoElement();
    if (!videoElement) {
      throw new Error('Video element not found');
    }
    return Math.floor(videoElement.currentTime);
  }

  /**
   * DOMから HTMLVideoElement を検索して取得する。
   * プラットフォームごとに取得方法が異なる場合はオーバーライド可能。
   */
  protected getVideoElement(): HTMLVideoElement | null {
    return document.querySelector('video');
  }

  // 子クラスで実装すべき抽象メソッド
  public abstract getChannelName(): Promise<string>;
  public abstract getVideoTitle(): Promise<string>;
  public abstract getVideoUrl(): Promise<string>;
  public abstract isLive(): Promise<boolean>;

  /**
   * リソース解放処理のデフォルト実装
   */
  public destroy(): void {
    // デフォルトでは何もしない
  }
}
