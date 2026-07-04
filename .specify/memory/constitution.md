<!--
Sync Impact Report:
- Version change: 1.0.0 -> 1.0.1
- Ratification Date: 2026-07-04
- Last Amended: 2026-07-04
- Modified principles: I. Speckit-Driven Flow (Speckit駆動フロー) (added mandatory clarification rule)
- Added sections: None
- Templates requiring updates: ✅ Updated (.specify/memory/constitution.md)
- Follow-up TODOs: None
-->

# Clip Bookmark Chrome Extension Constitution

## Core Principles

### I. Speckit-Driven Flow (Speckit駆動フロー)
開発はすべてSpeckitプロセス（`spec.md` -> `plan.md` -> `tasks.md`）に厳格に準拠して進めなければならない。タスクを整理し、進捗管理を行うこと。各タスクの開始時には適切なGitトピックブランチを作成・切り替えを行い、完了時には明確なコミットメッセージを残すこと。また、開発プロセスの各フェーズで適切なドキュメントを作成・更新し、履歴を残すこと。さらに、Speckitのプロセスを進める中で、不明点や曖昧な仕様が発生した場合は、自己判断で推測して進めるのではなく、必ず `/speckit-clarify` を使用するか、直接ユーザー（人間）に質問して明確化（clarify）しなければならない。

### II. Orchestrated Multi-Agent Design (オーケストレーション型マルチエージェント設計)
設計フェーズにおいては、主エージェント（Antigravity）はオーケストレーターに徹する。3人の異なるモデルのサブエージェントに設計案を個別に依頼し、その提案を統合・要約すること。さらに、統合された設計案に対して、別の3人の異なるモデルのサブエージェントにレビューを依頼し、設計のブラッシュアップを行うこと。

### III. Delegated Multi-Agent Implementation (委譲型マルチエージェント開発)
設計がユーザーに承認され合意が得られた後、実装（開発）は別の独立した開発用サブエージェントに依頼する。実装されたプロダクションコードおよびテストコードについては、さらに別の3人の異なるモデルのサブエージェントによるピアレビューを実施し、品質と安全性を確保すること。

### IV. Security & DRY Principles (セキュリティとDRY原則の徹底)
Chrome拡張機能の権限は必要最小限に留め、データの保存（Chrome Storage API等）やDOM操作時のXSS対策などのセキュリティ対策を徹底する。コードの重複を排除し（DRY原則）、単一責任の原則に基づいた再利用可能でメンテナンス性の高いモジュール構造を維持すること。

### V. Simultaneous Testing & Test Review (テスト実装とテストコードレビュー)
機能の実装と同時に必ずテストコードを実装すること。テストコードもプロダクションコードと同様に、セキュリティ、DRY原則、テストの妥当性についてサブエージェントによる厳格なレビューを受けること。

## Development Environment & Technology Stack
- **Technology**: Chrome Extension (Manifest V3), HTML/CSS (Vanilla), JavaScript / TypeScript, Twitch API.
- **Testing Framework**: Jest / Vitest (or browser extension testing tool).

## Communication Policy
- 本プロジェクトにおけるエージェント間のログ、作成するすべてのドキュメント（憲章、仕様書、計画書、タスク一覧等）、コミットメッセージ、およびユーザーとのやり取りは原則としてすべて日本語で行う。

## Governance
- 本憲章はプロジェクトの基本規則であり、すべてのエージェントおよびサブエージェントはこの規則に署名・準拠しなければならない。
- 本憲章の改訂は、原則としてユーザーの明示的な承認を必要とする。
- 変更がある場合は、バージョンをインクリメントし、Sync Impact Reportを更新すること。

**Version**: 1.0.1 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04

