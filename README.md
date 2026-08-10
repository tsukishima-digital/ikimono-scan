# 生き物スキャン

画像から生き物の種を端末内で分類する、非営利のOSS Webアプリです。

最初のリリース対象は日本で観察される甲虫です。クビアカツヤカミキリ（*Aromia bungii*）を重点対象にし、対象外の生き物や不鮮明な画像については確実な判定を保証しません。対応範囲はリリース後に段階的に広げます。

現在は、既存の甲虫分類実験から再利用できる学習・評価コードと、ブラウザ内推論を行うWebアプリの土台を公開しています。判定モデルはライセンスと由来を確認したリリース成果物として別途配信します。

## ライセンス

ソースコードは [Apache License 2.0](LICENSE) で公開します。

学習データには各提供者とiNaturalist上の個別ライセンスが適用されます。データセット本体はこのリポジトリに含みません。モデルの重みはソースコードと別の成果物であり、公開時に由来データとiNaturalistの条件に沿ったライセンスを明記します。

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

コミット前チェックにはgitleaks、uv、pre-commitが必要です。

```console
pre-commit install
pre-commit run --all-files
```

Cloudflareのリソース定義は `infra/` に置きます。デプロイはまだ行いません。
