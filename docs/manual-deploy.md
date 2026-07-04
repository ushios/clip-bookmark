# 手動アップロード・アップデート手順（GitHub Actions ビルド活用版）

本ドキュメントでは、**「ローカル環境（PC）でビルドを行わず、GitHub Actions がクラウド上でクリーンビルドした安全な ZIP パッケージ（`clip-bookmark-vX.Y.Z.zip`）をダウンロードして、Chrome ウェブストアにアップロードする手順」** について解説します。

PCのOS環境や Node.js のバージョンによるビルドのブレ（環境依存）を 100% 回避でき、Google Cloud などの面倒な API 認証キー設定も一切不要な、最も安全で簡単なアプローチです。

---

## 🛠️ アップデート手順（全 4 ステップ）

### ステップ 1：バージョン番号の更新とコミット
Chrome ウェブストアは、古いバージョンと同じ番号のパッケージを受け付けません。

1.  [src/manifest.json](file:///Users/shugo/Develops/ushios/clip-bookmark/src/manifest.json) を開き、`"version": "1.0.0"` の部分を新バージョン（例：`"1.0.1"`）に書き換えて保存します。
2.  変更を Git にコミットして、GitHub にプッシュします。
    ```bash
    git add src/manifest.json
    git commit -m "bump: version 1.0.1"
    git push origin main
    ```

---

### ステップ 2：バージョンタグのプッシュ（自動ビルド起動）
新しいバージョン番号の Git タグを作成し、プッシュします。これによって GitHub 上でクリーンビルドが自動開始されます。

1.  バージョンタグを作成します（必ず `v` で始まるバージョン番号にします）：
    ```bash
    git tag v1.0.1
    ```
2.  作成したタグをプッシュします：
    ```bash
    git push origin v1.0.1
    ```

---

### ステップ 3：GitHub から完成版 ZIP をダウンロードする
タグがプッシュされると、GitHub Actions が自動的にクリーンなコンテナ環境でビルドを完了し、GitHub のリリースページに ZIP ファイルを添付してくれます。

1.  リポジトリの **[Releases](https://github.com/ushios/clip-bookmark/releases)** ページを開きます。
2.  新しく作成されたリリース（例：`Release v1.0.1`）の「Assets」から、**`clip-bookmark-v1.0.1.zip`** をダウンロードします。
    *※このファイルは、クラウド上で完全にクリーンにビルドされた安全なZIPパッケージです。*

---

### ステップ 4：デベロッパーコンソールへアップロード
1.  [Chrome ウェブストア デベロッパーコンソール](https://chrome.google.com/webstore/devconsole/) にログインします。
2.  「Clip Bookmark」の管理画面に入り、左側メニューの **「パッケージ」** をクリックします。
3.  **「新しいパッケージをアップロード」** をクリックします。
4.  ステップ 3 でダウンロードした **`clip-bookmark-v1.0.1.zip`** をドラッグ＆ドロップしてアップロードします。
5.  画面右上の **「審査に提出」** をクリックして完了です！

---

## 🔒 補足：エラーが出る場合のチェック項目

もしタグをプッシュしてもリリースページが自動作成されない、またはエラーになる場合は、GitHubのワークフロー権限を確認してください。

1.  リポジトリの **「Settings (⚙️)」** タブをクリックします。
2.  左側メニューの **「Actions」** ➡ **「General」** をクリックします。
3.  一番下までスクロールし、「Workflow permissions」で **「Read and write permissions」** にチェックを入れて保存します。
