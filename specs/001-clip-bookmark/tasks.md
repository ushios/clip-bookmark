# Tasks: Clip Bookmark Trigger (クリップ ブックマーク・トリガー機能)

**Input**: Design documents from `specs/001-clip-bookmark/`

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: 憲章 V「テスト実装の同時遂行」に基づき、テストコードの実装は必須（MANDATORY）です。各ユーザーストーリーの実装タスクに先立ち、必ずテストコードを記述して、実行結果が失敗（Red）になることを確認した上で実装に進んでください。

**Organization**: 各ユーザーストーリーが独立して実装およびテストできるよう、ストーリーごとにフェーズを分けて整理しています。

---

## Format: `[ID] [P?] [Story] Description`

*   **[P]**: 並行実行可能なタスク（異なるファイルで依存関係がないもの）
*   **[Story]**: 対象のユーザーストーリーID（例: [US1], [US2], [US3]）
*   説明に具体的なファイルパスを含めます。

---

## Phase 1: Setup (プロジェクトセットアップ)

**Purpose**: プロジェクトの初期設定および共通ディレクトリ構造の初期化

- [x] T001 プロジェクト共通ディレクトリの作成 (`src/background/`, `src/content/`, `src/popup/`, `src/common/`)
- [x] T002 npm初期化とTypeScript設定ファイルの作成 (`package.json`, `tsconfig.json`, `src/manifest.json`)
- [x] T003 [P] 開発・検証用インフラの構築（Linter, Formatter, Vitest の導入・設定）

---

## Phase 2: Foundational (共通基盤・前提条件)

**Purpose**: すべてのユーザーストーリーの動作に必要となるコア共通モジュールおよび型定義の実装

**⚠️ CRITICAL**: このフェーズが完了するまで、個々のユーザーストーリーの実装を開始することはできません。

- [x] T004 共通データモデルおよび型定義の実装 (`src/common/models/bookmark.model.ts`, `src/common/models/settings.model.ts`, `src/common/models/messages.ts`)
- [x] T005 [P] 共通ストレージ操作および1,000件FIFOローテーション機能を備えた `StorageManager` シングルトンの実装 (`src/common/storage/storage.manager.ts`)
- [x] T006 [P] 送信元検証・URL検証・文字列サニタイズ用セキュリティユーティリティの実装 (`src/common/utils/security.ts`)
- [x] T007 プレイヤー時間・情報取得のための `BasePlatformAdapter` 抽象クラスおよび `PlatformAdapter`, `ChatObservable` インターフェースの実装 (`src/content/platforms/base.adapter.ts`, `src/content/platforms/adapter.interface.ts`)

**Checkpoint**: 共通基盤完了。各ユーザーストーリーの実装を並行して開始可能。

---

## Phase 3: User Story 1 - キーボードショートカットによるブックマーク記録 (Priority: P1) 🎯 MVP

**Goal**: Alt+Shift+B などのショートカットキー押下時に、経過時間を取得して保存し、Shadow DOM内にトースト通知を表示する。

**Independent Test**: Twitch視聴ページでショートカットキーを押し、即座にトースト通知（フルスクリーンでも最前面に表示）が立ち上がることを確認する。

### Tests for User Story 1 (MANDATORY) ⚠️
> **※実装前にテストを作成し、テストが正しく失敗することを確認してください。**
- [x] T008 [P] [US1] `BasePlatformAdapter` と `StorageManager` のモックを使用したショートカット記録処理およびトースト通知の単体テストの実装 (`tests/unit/shortcut.test.ts`)

### Implementation for User Story 1
- [x] T009 [P] [US1] `chrome.commands` からのショートカット入力を監視・受信し、アクティブタブに記録開始指示を送る Service Worker ロジックの実装 (`src/background/index.ts`)
- [x] T010 [P] [US1] TwitchプレイヤーのDOM要素から経過時間やチャンネル名、タイトルを抽出する `TwitchAdapter` の実装 (`src/content/platforms/twitch.adapter.ts`)
- [x] T011 [US1] 受信した指示に応じて `TwitchAdapter` から現在時間情報を抽出し Service Worker へ返信する `CommandObserver` の実装 (`src/content/observers/command.observer.ts` - T010に依存)
- [x] T012 [US1] 受信したデータの Sender (ID/Origin/Tab) を検証し `StorageManager` を用いて非同期で書き込む Service Worker ハンドラーの実装 (`src/background/handlers/` - T005, T006に依存)
- [x] T013 [US1] `chrome.storage.onChanged` による書き込み変更を監視し、Shadow DOMを生成してプレイヤーコンテナ内に安全に描画するトースト通知UIの実装 (`src/content/ui/`)

**Checkpoint**: ショートカットキーによるブックマーク保存・画面通知が独立して動作することを確認。

---

## Phase 4: User Story 2 - チャットコメントによる自動ブックマーク記録 (Priority: P1)

**Goal**: チャット欄にトリガーワード（例: `!bm`）を送信した際、自動で現在時間を検知して保存する。設定でチャット監視をOFFにした場合は完全に監視を停止する。

**Independent Test**: チャットで `!bm` と入力して送信した際、トースト通知が表示され保存されること。設定でチャット監視を無効化した際、チャット入力による打刻が機能せず、CPUの無駄な処理（MutationObserver）が動いていないことを確認。

### Tests for User Story 2 (MANDATORY) ⚠️
> **※実装前にテストを作成し、テストが正しく失敗することを確認してください。**
- [x] T014 [P] [US2] IME入力中の除外、自分以外の発言の早期リターン、設定OFF時の `MutationObserver` 切断動作を検証する単体テストの実装 (`tests/unit/chat.test.ts`)

### Implementation for User Story 2
- [x] T015 [P] [US2] チャット入力エリア (`textarea`) および送信ボタンのキー/クリックイベントをフックし、IME考慮 (`isComposing`）を行って自発言のトリガーワードを検知する `ChatObserver` の実装 (`src/content/observers/chat.observer.ts`)
- [x] T016 [P] [US2] チャットログコンテナの監視において、自分の発言を示すCSSクラス以外を早期リターンする最適化された `MutationObserver`（フォールバック用）の実装 (`src/content/observers/chat.observer.ts`)
- [x] T017 [US2] 設定同期 (`chrome.storage.sync`) から `enableChatObserver` の変更を監視し、ON/OFFトグルに応じて `ChatObserver` の監視開始・切断を制御するロジックの統合 (`src/content/index.ts`)

**Checkpoint**: チャットトリガーによる保存機能が、ショートカット保存と並行して正しく機能することを確認。

---

## Phase 5: User Story 3 - ポップアップUIでの履歴確認と該当時間へのジャンプ (Priority: P1)

**Goal**: ポップアップ上で最新50件の履歴を表示し、削除、トリガーワードの編集、およびタイムスタンプ付きURL（URL検証付き）へのジャンプを行えるようにする。

**Independent Test**: ポップアップを開いて履歴が瞬時（0.2秒以下）に描画され、項目をクリックするとVODの該当時間で新規タブが開くこと。トリガーワードの追加や項目削除が正しく永続化されることを確認。

### Tests for User Story 3 (MANDATORY) ⚠️
> **※実装前にテストを作成し、テストが正しく失敗することを確認してください。**
- [x] T018 [P] [US3] `DocumentFragment` による高速DOM生成、項目削除時のストレージ更新、および遷移先URL正規表現パターンのセキュリティテストの実装 (`tests/unit/popup.test.ts`)

### Implementation for User Story 3
- [x] T019 [P] [US3] ポップアップ起動と同時に非同期でストレージ取得を開始し、`DocumentFragment` を用いて最新50件を構築・描画する Vanilla TS UI ロジックの実装 (`src/popup/index.ts`)
- [x] T020 [P] [US3] 設定データのロードおよびカスタムトリガーワードを追加・削除して `StorageManager` に同期保存する設定フォームUIの実装 (`src/popup/index.ts`)
- [x] T021 [US3] 安全なURL検証スキームを通した上で、クリックされたブックマークのVODページ（`?t=...`）を `chrome.tabs.create` で新規タブにて開く遷移ロジックの実装 (`src/popup/index.ts` - T006に依存)
- [x] T022 [US3] 任意のブックマークの削除ボタンをクリックした際、`StorageManager` でデータを消去しUIから項目を即時削除するロジックの実装 (`src/popup/index.ts` - T005に依存)

**Checkpoint**: ポップアップ上での確認・遷移・設定がすべて問題なく機能することを確認。

---

## Phase N: Polish & Cross-Cutting Concerns (ポーリッシュ & 横断調整)

**Purpose**: 製品レベルの品質確保に向けた最終調整とドキュメント整備

- [x] T023 [P] 拡張機能アイコンのアセット配置と `manifest.json` のプロダクション用構成定義
- [x] T024 プロジェクト全体の動作確認（手動結合テスト、フルスクリーン時の挙動検証、エラーハンドリング確認）
- [x] T025 [P] 全テストコードの一斉実行およびパス確認 (`vitest run` による100%成功確認)
- [x] T026 インストール・セットアップ手順、手動テスト仕様、およびV1クイックスタートガイドのドキュメント記述

---

## Dependencies & Execution Order

### Phase Dependencies
1.  **Setup (Phase 1)**: 依存関係なし。最初に実行。
2.  **Foundational (Phase 2)**: Setup完了後に開始。**全てのユーザーストーリー開発をブロックします**。
3.  **User Stories (Phase 3〜5)**: Foundational完了後に開始可能。
    *   US1 (Phase 3) はMVPであり最優先。
    *   US2 (Phase 4) および US3 (Phase 5) は Foundational 完了後、並行して進めることが可能ですが、実機検証（手動テスト）はUS1完了後が望ましいです。
4.  **Polish (Phase N)**: すべてのユーザーストーリーが実装完了し、単体テストが通った後に開始。

### Parallel Execution Examples
```bash
# Phase 1 の並行実行（Linter/Formatter設定とTS設定は並行可能）
Task: T002 と T003

# Phase 2 の並行実行（モデル定義、StorageManager、セキュリティユーティリティ）
Task: T005 と T006

# Phase 3-5 の並行実行（共通基盤が完成していれば、各ストーリーの最初のテストや個別UIは並行可能）
Task: T008 (US1テスト), T014 (US2テスト), T019 (US3ポップアップUI)
```

### Implementation Strategy (実装戦略)
1.  **MVPファースト**: まず Setup -> Foundational -> User Story 1 (ショートカット保存とトースト表示) を完成させ、実際にキーを押してブックマークがストレージに入る最小機能セットを動作確認します。
2.  **インクリメンタルデリバリー**: その後、チャットトリガー機能（US2）をアドオンし、最後にポップアップ表示UI（US3）を結合して完全なプロダクション機能にします。各機能ごとに必ず Vitest による単体テストを追加・実行します。
