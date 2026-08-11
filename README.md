# 生き物スキャン

画像から生き物の種を端末内で分類する、非営利のOSS Webアプリです。

最初のリリース対象は日本で観察される甲虫です。クビアカツヤカミキリ（*Aromia bungii*）を重点対象にし、対象外の生き物や不鮮明な画像については確実な判定を保証しません。対応範囲はリリース後に段階的に広げます。

Webアプリはカメラを優先して起動し、撮影または画像選択の後にだけ判定モデルを取得します。検証済みモデルはブラウザに保存して再利用します。判定モデルはライセンスと由来を確認したリリース成果物として、ソースコードとは別に配信します。

## 現在の公開状態

甲虫分類モデルv0.1.0はONNXとしてモデル用R2 bucketへ配置済みで、配信manifestもmainで管理しています。モデルの評価、配布条件、学習データ監査は[モデルカード](web/public/models/v0.1.0.md)に記録しています。

本番Custom Domainの公開と更新は、mainを対象とした手動のGitHub Actions workflowだけが行います。公開前はドメインを停止したまま、UI変更とブラウザ検証を進められます。

MVPは甲虫の写真を入力する条件付き分類サービスです。対象外画像を広く検出することより、対応範囲を利用者へ明示し、対象画像について撮影・選択から端末内推論、結果表示、再試行までを安定して完了できることを優先します。

## ライセンス

ソースコードは [Apache License 2.0](LICENSE) で公開します。

学習データには各提供者とiNaturalist上の個別ライセンスが適用されます。データセット本体はこのリポジトリに含みません。モデル重みにはソースコードと別の配布条件が適用されます。現在の条件とattribution方法は[モデルカード](web/public/models/v0.1.0.md)を確認してください。

## 開発

Python 3.11または3.12を使用します。GPU学習環境はDockerfileを利用できます。

```console
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
pytest
```

WebアプリはReact、ONNX Runtime Web、Cloudflare Workers Static Assetsで構成します。WASMを互換性の基準とし、利用可能なブラウザではWebGPUを優先します。

```console
cd web
npm ci
npm test
npm run dev
```

ローカルの品質チェックにはgitleaks、uv、pre-commit、Terraformが必要です。Webアプリの依存関係も事前にインストールします。

```console
uv sync --extra dev
cd web && npm ci && cd ..
task hooks:install
uv run pre-commit run --all-files
```

pre-commitではRuff、ESLint、Terraformのフォーマットと構成検証を実行します。pre-pushでは変更範囲に応じてPythonテスト、Webテスト、TypeScript型検査、Terraform検証を実行します。

Cloudflareのリソース定義は `infra/` に置きます。本番操作は、確認文字列を要求する手動workflowから実行します。通常のmainへのpushやPRのマージではデプロイしません。
