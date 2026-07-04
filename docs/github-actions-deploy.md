# GitHub Actions 自動デプロイ設定マニュアル (Chrome Web Store)

本ドキュメントは、GitHub Actions を使用して Chrome ウェブストアへ自動アップロード（デプロイ）するために必要な 4 つの認証情報（`EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`）の取得手順をまとめたものです。

---

## 1. EXTENSION_ID の取得手順

`EXTENSION_ID` は、Chrome ウェブストア上でのあなたの拡張機能の固有ID（32文字のランダムな英字）です。

1. **[Chrome デベロッパー ダッシュボード](https://chrome.google.com/webstore/devconsole/)** にアクセスします。
2. 登録料（5ドル）の支払いを完了し、右上の「新しいアイテム」から一度ビルドしたZIPファイルをアップロードして仮登録します。
3. 登録されたアイテムの詳細画面を開きます。
4. URLの末尾、または詳細情報の「ID」欄に表示されている 32 文字の文字列（例: `abcdefghijklmnopqrstuvwxyzabcdef`）をコピーします。
   * 例: `https://chrome.google.com/webstore/devconsole/detail/abcdefghijklmnopqrstuvwxyzabcdef/...` の `abcdef...` 部分がIDです。

---

## 2. CLIENT_ID & CLIENT_SECRET の取得手順

これらは Google API Console 経由で Chrome Web Store API を操作するために必要な鍵です。

### ステップ 2-1: Google Cloud プロジェクトの作成と API 有効化
1. **[Google Cloud Console](https://console.cloud.google.com/)** にアクセスします。
2. 画面上部のプロジェクト選択メニューから **「プロジェクトの作成」** をクリックして新規プロジェクト（例: `Twitch-Bookmark-Deploy`）を作成します。
3. 左メニューの「API とサービス」 > **「ライブラリ」** を選択します。
4. 検索欄に **「Chrome Web Store API」** と入力し、表示されたAPIを選択して **「有効にする」** をクリックします。

### ステップ 2-2: OAuth 同意画面の設定
1. 左メニューの「API とサービス」 > **「OAuth 同意画面」** を選択します。
2. User Type で **「外部」**（External）を選択し、「作成」をクリックします。
3. アプリ情報（アプリ名、ユーザーサポートメール、デベロッパーの連絡先情報）を入力し、他はデフォルトのまま「保存して次へ」を進めます。
4. 「テストユーザー」の画面で、**「ユーザーを追加」** をクリックし、**あなたのデベロッパーダッシュボードのアカウント（Googleアカウントのメールアドレス）** を登録します。（※これを行わないと、次のリフレッシュトークン取得で権限エラーになります）
5. 最後まで進めてダッシュボードに戻ります。

### ステップ 2-3: 認証情報の作成
1. 左メニューの「API とサービス」 > **「認証情報」** を選択します。
2. 画面上部の **「認証情報を作成」** > **「OAuth クライアント ID」** を選択します。
3. アプリケーションの種類として **「デスクトップ アプリ」**（Desktop App）を選択します。
4. 名前（例: `Web Store CLI`）を入力し、**「作成」** をクリックします。
5. 画面に表示される **「クライアント ID」**（CLIENT_ID）と **「クライアント シークレット」**（CLIENT_SECRET）をコピーしてメモ帳等に保存します。

---

## 3. REFRESH_TOKEN の取得手順

`REFRESH_TOKEN` は、GitHub Actions がパスワードを入力することなく、あなたの代わりにAPIを操作するための期限なしのトークンです。

1. ご自身のPCのターミナル（コマンドプロンプト）を開きます。
2. 以下のコマンドを実行して、トークン取得用の対話式 CLI ツールを起動します。
   ```bash
   npx chrome-webstore-upload-cli token
   ```
3. ターミナル上で以下のように入力を求められるので、先ほど取得した値を入力します。
   * `Application Client ID`: あなたの **CLIENT_ID** を入力
   * `Application Client Secret`: あなたの **CLIENT_SECRET** を入力
4. 入力後、ターミナル上に認証用URL（`https://accounts.google.com/o/oauth2/...`）が表示されます。
5. そのURLをブラウザに貼り付けてアクセスします。
6. **必ず、デベロッパーダッシュボードに登録しているGoogleアカウント**を選択してログインします。
7. 「このアプリは Google によって検証されていません」という警告が出た場合は、「詳細」 > 「（安全ではないページ）に移動」をクリックして許可します。
8. 権限許可の確認画面で「許可」または「続行」をクリックします。
9. 認証が完了すると、ブラウザ画面に「認証コード（Authorization Code）」が表示されるか、または localhost にリダイレクトされます。画面に表示されたコードをコピーします。
10. ターミナルに戻り、`Enter the code that you got from the browser:` の後にコピーしたコードを貼り付けて Enter を押します。
11. 成功すると、ターミナル上に `Refresh token: 1//0gxxxx...` のようにトークンが出力されます。この **`Refresh token` の値全体** をコピーして保存します。

---

## 4. GitHub Secrets への登録

取得した 4 つの情報を GitHub のリポジトリに登録し、 Actions で利用できるようにします。

1. GitHub上のあなたのリポジトリページ（`twitch-bookmark`）を開きます。
2. 画面上部のメニューから **「Settings」**（設定）を選択します。
3. 左側メニューの **「Secrets and variables」** > **「Actions」** を選択します。
4. **「New repository secret」**（新しいシークレット）ボタンをクリックします。
5. 以下の名称と値のペアで、**計 4 個** のシークレットを登録します。

| Name | Value |
| :--- | :--- |
| `EXTENSION_ID` | 1で取得した 32文字の拡張機能ID |
| `CLIENT_ID` | 2-3で取得した クライアントID |
| `CLIENT_SECRET` | 2-3で取得した クライアントシークレット |
| `REFRESH_TOKEN` | 3で取得した リフレッシュトークン |

これで設定はすべて完了です！
タグプッシュ（`git tag v1.0.0 && git push origin v1.0.0`）を行うと、自動的にビルドされてストアへのアップデートと審査申請が実行されます。
