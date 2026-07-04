# 手動アップロード・アップデート手順（GitHub Release トリガー版）

本ドキュメントでは、**「GitHub上でリリースを作成・公開した際に、GitHub Actions が自動的にクラウド上でビルドした安全な ZIP パッケージ（`clip-bookmark-vX.Y.Z.zip`）を作成・添付し、それをダウンロードしてストアにアップロードする手順」** について解説します。

コマンドラインで `git tag` などのコマンドを実行する必要が一切なく、GitHubの画面操作だけで安全にクリーンビルドされたパッケージが手に入ります。

---

## 🛠️ アップデート手順（全 4 ステップ）

### ステップ 1：バージョン番号の更新とコミット
Chrome ウェブストアは、古いバージョンと同じ番号のパッケージを受け付けません。

1.  [src/manifest.json](file:///Users/shugo/Develops/ushios/clip-bookmark/src/manifest.json) を開き、`"version"` の部分を新バージョン（例：`"1.0.1"`）に書き換えて保存します。
2.  変更を Git にコミットして、GitHub にプッシュします。
    ```bash
    git add src/manifest.json
    git commit -m "bump: version 1.0.1"
    git push origin main
    ```
    *※マージ保護ルールが有効な場合は、プルリクエストを作成して `main` ブランチにマージしてください。*

---

### ステップ 2：GitHub 画面でリリースを作成・公開する
GitHubの画面上でリリースを作成するだけで、自動ビルドがバックグラウンドで開始されます。

1.  リポジトリの **[Releases](https://github.com/ushios/clip-bookmark/releases)** ページを開きます。
2.  **「Draft a new release」**（または「Create a new release」）ボタンをクリックします。
3.  以下の設定を入力します：
    *   **Choose a tag**: プッシュされたバージョン（例：`v1.0.1`）を新規タグ名として入力し、**「Create new tag: v1.0.1 on publish」** を選択します。
    *   **Target**: `main` ブランチのままでOKです。
    *   **Release title**: `Release v1.0.1` など。
    *   **Description**: **「Generate release notes」** ボタンをクリックすると、前回のバージョンからのコミット履歴（何が変更されたか）が自動で挿入されます！必要に応じて手動で編集も可能です。
4.  画面最下部にある青い **「Publish release」** ボタンをクリックします。

---

### ステップ 3：GitHub から完成版 ZIP をダウンロードする
リリースが公開（Publish）されると、GitHub Actions が自動的に起動し、ビルドが完了した ZIP ファイルを同じリリースページへ自動で添付します。

1.  リリースを公開後、約 1 分ほど待ってリリースページをブラウザで再読み込みします。
2.  リリースの「Assets」エリアに、自動で **`clip-bookmark-v1.0.1.zip`** が添付されているのでダウンロードします。
    *※このファイルは、クラウド上で完全にクリーンにビルドされた安全なZIPパッケージです。*

---

### ステップ 4：デベロッパーコンソールへアップロード
1.  [Chrome ウェブストア デベロッパーコンソール](https://chrome.google.com/webstore/devconsole/) にログインします。
2.  「Clip Bookmark」の管理画面に入り、左側メニューの **「パッケージ」** ➡ **「新しいパッケージをアップロード」** をクリックします。
3.  ダウンロードした **`clip-bookmark-v1.0.1.zip`** をドラッグ＆ドロップしてアップロードします。
4.  画面右上の **「審査に提出」** をクリックして完了です！

---

## 🔒 補足：エラーが出る場合のチェック項目

もしリリースを公開してもZIPファイルが自動添付されない、または Actions ログでエラーになる場合は、以下の書き込み権限を確認してください。

1.  リポジトリの **「Settings (⚙️)」** タブをクリックします。
2.  左側メニューの **「Actions」** ➡ **「General」** をクリックします。
3.  一番下までスクロールし、「Workflow permissions」で **「Read and write permissions」** にチェックを入れて保存します。
