# 生き物スキャン

画像から生き物の種を端末内で分類するOSS Webアプリです。

## 概要

生き物スキャンは、写真から生き物の種類の候補を調べる入口を広げるためのオープンソースプロジェクトです。身近な生き物を知りたい人が、目的を問わず使えることを目指しています。

判定結果は名前の候補で、専門家による同定ではありません。

## 現在できること

最初のリリースは、日本で観察される甲虫422種を対象にしています。クビアカツヤカミキリ（*Aromia bungii*）を重点対象にし、対応範囲は甲虫に限定せず、日本で観察される生き物へ段階的に広げます。対象外の生き物や不鮮明な画像については、確実な判定を保証しません。

案内ページから判定画面を開き、カメラ撮影または保存済み写真を使います。写真は外部へ送信せず、端末内で分類します。判定モデルは写真を用意した後に取得し、検証済みのモデルをブラウザに保存して再利用します。

## 現在の公開状態

生き物スキャンは[ikimono-scan.app](https://ikimono-scan.app)で公開しています。本番の公開と更新は、mainを対象とした手動のGitHub Actions workflowから行います。デプロイ後は公開URL、モデルの整合性、実ブラウザでの推論を検証します。

甲虫分類モデルv0.1.0はONNXとしてモデル用R2 bucketへ配置済みで、配信manifestもmainで管理しています。対応種と一般向けの評価値はmanifestからWebページへ表示し、詳しい評価、配布条件、学習データ監査は[モデルカード](web/public/models/v0.1.0.md)に記録しています。

MVPは甲虫の写真を入力する条件付き分類サービスです。対象外画像を広く検出することより、対応範囲を利用者へ明示し、対象画像について撮影・選択から端末内推論、結果表示、再試行までを安定して完了できることを優先します。

## ライセンス

ソースコードは [Apache License 2.0](LICENSE) で公開します。

生き物一覧の写真には、写真ごとのCC0、CC BY 4.0、またはCC BY-NC 4.0が適用されます。作者、出典、ライセンスは[写真カタログ](web/src/content/species-photos.json)に記録しており、Apache License 2.0の対象には含まれません。

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
