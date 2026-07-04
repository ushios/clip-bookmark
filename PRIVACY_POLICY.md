# Privacy Policy / プライバシーポリシー

This Privacy Policy describes how the "Clip Bookmark" Chrome extension handles your data.
本プライバシーポリシーは、Chrome拡張機能「Clip Bookmark」（以下「本拡張機能」）におけるユーザーデータの取り扱いについて説明するものです。

---

## English

### 1. Data Collection and Usage
- **No Personal Data Collection**: Clip Bookmark does not collect, store, or transmit any personally identifiable information (PII).
- **Local Data Storage**: All bookmarks (video URLs, timestamps, titles, and channel names) and user settings are stored locally on your device using Chrome's secure storage APIs (`chrome.storage.local` and `chrome.storage.sync`).
- **No Server Transmission**: No data is ever sent to our servers or any third-party servers. Your data belongs entirely to you.

### 2. Chrome Extension Permissions
Clip Bookmark requests the minimum necessary permissions to function:
- **`activeTab`**: Used to retrieve the URL and title of the current Twitch stream/video only when you open the popup UI to filter history.
- **`tabs`**: Used to open bookmarked links in new tabs and update active tab states.
- **Host Permission (`https://www.twitch.tv/*`)**: Required to inject the content script only on Twitch to detect keyboard shortcuts and monitor chat trigger words for bookmarking. No other websites are accessed.

### 3. Changes to This Policy
We may update this Privacy Policy from time to time. Any changes will be posted on this page.

### 4. Contact
If you have any questions about this Privacy Policy, please contact us via our GitHub Repository.

---

## 日本語

### 1. データの収集と利用について
- **個人情報の非収集**: 本拡張機能は、氏名、メールアドレス、その他の個人を特定できる情報（個人情報）を収集、保存、または外部へ送信することは一切ありません。
- **データのローカル保存**: 保存されたブックマーク（動画URL、タイムスタンプ、タイトル、配信者名等）および設定情報は、ブラウザが提供する安全なストレージAPI（`chrome.storage.local` および `chrome.storage.sync`）を使用し、すべてユーザーのローカル端末内にのみ保存されます。
- **外部送信の排除**: 収集されたデータが開発者のサーバーや第三者のサーバーへ送信されることはありません。データは完全にユーザーのコントロール下にあります。

### 2. 要求する権限（パーミッション）について
本拡張機能は、機能を提供するために必要最小限の権限のみを要求します：
- **`activeTab`**: ポップアップを開いた際に、現在視聴中のTwitch動画のURLやタイトルを読み取り、関連する履歴を絞り込んで表示するために使用します。
- **`tabs`**: 保存されたブックマークリンクを新しいタブで安全に開く（復元する）ために使用します。
- **ホスト権限 (`https://www.twitch.tv/*`)**: Twitchのページ上でショートカットキー（Alt+Shift+B）の入力を検知したり、チャットのトリガーワードを監視してブックマークを打刻するスクリプトを安全に動作させるために使用します。Twitch以外のWebサイトにアクセスすることはありません。

### 3. 本ポリシーの変更
本プライバシーポリシーは、必要に応じて更新される場合があります。最新のポリシーは本ページにて常に公開されます。

### 4. お問い合わせ
本プライバシーポリシーに関するご質問やお問い合わせは、本リポジトリのGitHub Issueよりご連絡ください。

---

*Last Updated: July 4, 2026 / 最終更新日: 2026年7月4日*
