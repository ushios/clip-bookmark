import { BasePlatformAdapter } from './base.adapter';
import { parseTimeStringToSeconds } from '../../common/utils/time';

/**
 * Twitch用の PlatformAdapter 実装
 * TwitchのビデオプレイヤーおよびDOMから必要な情報（再生時間、チャンネル名、タイトルなど）を抽出します。
 */
export class TwitchAdapter extends BasePlatformAdapter {
  /**
   * 現在視聴中のコンテンツがライブ配信中かどうかを判定する
   * URLに "/videos/" が含まれていない場合、およびライブインジケータが存在する場合はライブと判定。
   */
  public async isLive(): Promise<boolean> {
    const isVodUrl = window.location.pathname.includes('/videos/');
    const liveIndicator = document.querySelector('[data-a-target="player-live-indicator"], .live-indicator-container');
    
    return !isVodUrl || !!liveIndicator;
  }

  /**
   * 配信の開始時刻を取得する。
   * ページ内の <script> タグの初期状態データから startedAt または stream.createdAt を検索する。
   */
  private getStreamStartedAt(): Date | null {
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      const content = script.textContent;
      if (content) {
        // startedAt:"2026..." または createdAt:"2026..." のいずれかを緩めに検索
        const match = content.match(/"(?:started_?at|createdAt)"\s*:\s*"([^"]+)"/i);
        if (match && match[1]) {
          try {
            const date = new Date(match[1]);
            if (!isNaN(date.getTime())) {
              return date;
            }
          } catch (e) {
            console.error('Failed to parse startedAt date:', e);
          }
        }
      }
    }
    return null;
  }

  /**
   * 現在の再生位置（秒数）を取得する。
   * ライブ配信中の場合は配信開始時刻（startedAt）と現在の実時間の差分から「真の配信時間」を算出する。
   * 取得できない場合は、プレイヤー外部の Uptime 表示タイマー（視聴開始からの時間ではないもの）を抽出する。
   */
  public override async getCurrentTime(): Promise<number> {
    const live = await this.isLive();
    if (live) {
      // 1. 配信開始日時 (startedAt) からの絶対経過秒数を算出 (最も正確)
      const startedAt = this.getStreamStartedAt();
      if (startedAt) {
        const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        if (elapsedSeconds > 0) {
          return elapsedSeconds;
        }
      }

      // 2. プレイヤー外部の Uptime（配信経過時間）表示要素を探索
      // プレイヤー内のシークバー（[data-a-target="player-seek-bar-current-time"]）は視聴開始からの時間なので除外する
      const uptimeSelectors = [
        '.live-time',
        'span.live-time',
        '.uptime',
        'span.uptime',
        '.stream-uptime',
        '.live-indicator-container',
        '[data-a-target="player-live-indicator"]',
        '.live-indicator-container span',
        '.channel-status-info',
      ];

      for (const selector of uptimeSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of Array.from(elements)) {
          // コントロールバー（.player-controls や .video-player）の中にあるものは「視聴開始からの経過時間」になっているためスキップ
          if (el.closest('.player-controls') || el.closest('.video-player')) {
            continue;
          }

          const text = el.textContent?.trim();
          if (text) {
            // hh:mm:ss または mm:ss を正規表現で抽出
            const timeMatch = text.match(/(?:(\d+):)?(\d+):(\d+)/);
            if (timeMatch) {
              const seconds = parseTimeStringToSeconds(timeMatch[0]);
              if (seconds > 0) {
                return seconds;
              }
            }
          }
        }
      }
    }

    // VOD、またはライブ経過時間の取得に失敗した場合は <video> 要素の currentTime を返す
    return super.getCurrentTime();
  }

  /**
   * 配信者（チャンネル）の名前を取得する
   */
  public async getChannelName(): Promise<string> {
    // 1. VODの場合は、チャンネルヘッダー領域からチャンネル名を取得
    const channelHeaderSelectors = [
      '[data-a-target="channel-header-title"]',
      'a.channel-header__user-avatar',
      '.channel-info-bar-metadata-user-channel-link',
      'span.channel-header__user-name',
      '.metadata-layout-area [data-a-target="user-channel-link"]',
    ];

    for (const selector of channelHeaderSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // テキストコンテンツまたは href からチャンネル名を抽出
        const text = element.textContent?.trim();
        if (text) {
          return text;
        }
        const href = element.getAttribute('href');
        if (href) {
          const parts = href.replace(/^\//, '').split('/');
          if (parts[0]) return parts[0];
        }
      }
    }

    // 2. ライブ配信中の場合、またはDOMから取得できない場合はURLの第1パスから取得
    const pathParts = window.location.pathname.replace(/^\//, '').split('/');
    if (pathParts[0] && pathParts[0] !== 'videos' && pathParts[0] !== 'directory' && pathParts[0] !== 'search') {
      return pathParts[0];
    }

    return 'Unknown Channel';
  }

  /**
   * 動画または配信のタイトルを取得する
   */
  public async getVideoTitle(): Promise<string> {
    const titleSelectors = [
      '[data-a-target="stream-title"]',
      'h2[data-a-target="stream-title"]',
      '.video-player__container h2',
      '.metadata-layout-area h2',
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }

    // フォールバック: ドキュメントタイトルからTwitch特有の接尾辞を除去
    const docTitle = document.title;
    if (docTitle) {
      return docTitle.replace(/ - Twitch$/, '').trim();
    }

    return 'Untitled Video';
  }

  /**
   * 現在の動画（VOD）のベースURL、またはライブ配信のチャンネルURLを取得する
   */
  public async getVideoUrl(): Promise<string> {
    // クエリパラメータを除去したクリーンなURLを返却
    const url = new URL(window.location.href);
    url.search = ''; // t= などのパラメータをクリア
    url.hash = '';
    return url.toString();
  }
}
