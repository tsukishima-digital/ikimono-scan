# Model release policy

モデル重みはソースコードのApache-2.0ライセンスの対象外です。各リリースには、モデルのバージョン、SHA-256、ライセンス、学習データの由来、対象種、評価結果を記録します。

学習画像はモデルへ同梱せず、データセットも公開しません。既存の甲虫モデルは、著作物の表現を享受させない情報解析として日本の著作権法第30条の4を利用根拠にします。モデルごとの学習目的、iNaturalist利用条件との整合、写真ライセンスの監査結果、未解決項目はバージョン別のモデルカードに記録します。学習画像を復元または生成できるモデルへ、この判断を流用してはいけません。

Webアプリが読む `manifest.json` には最低限、`version`、`modelUrl`、`sha256`、`license`、`source`、`imageSize`、`classes` を含めます。ONNXはバージョン付きの不変URLでR2に置き、manifestはGitで管理します。同じURLの重みは上書きせず、修正時は新しいバージョンを発行します。

変換とアップロードには次のコマンドを使います。

```console
task model:export \
  CHECKPOINT=/path/to/best.pt \
  VERSION=0.1.0 \
  LICENSE=CC-BY-NC-4.0 \
  SOURCE=/models/v0.1.0.md

task model:upload BUNDLE_DIR=artifacts/models/v0.1.0
```

`model:export`はcheckpointからONNXとmanifestを生成し、公開条件とSHA-256を検証します。`model:upload`は同名オブジェクトがR2に存在しないことを確認してONNXだけを送り、private bucketから再取得したSHA-256が一致した場合に限り、Git管理対象のmanifestを更新します。両方を続けて行う場合は`task model:prepare-and-upload`を使います。

manifestの変更はPRで確認し、mainへ反映した後に`task deploy`で通常のGitHub Actionsデプロイを起動します。デプロイ後は`model:smoke`が公開URLからモデルを再取得し、同じSHA-256を検証します。これにより、private bucketへの転送、ユーザー向けモデルの切り替え、公開経路の検証を分離します。`UNPUBLISHED`の重みはアップロードできません。

## 学習データの監査

学習に利用したsplit manifestを入力し、ファイル名のobservation IDとURLハッシュを現在のiNaturalist photo IDへ照合します。

```console
ikimono-scan-ml-audit-provenance \
  --split-manifest /path/to/split_manifest.jsonl \
  --output /private/path/provenance.jsonl \
  --summary /private/path/summary.json
```

出力にはobservation ID、photo ID、creator、写真ページ、asset URL、photo-level license、attributionを含みます。監査JSONLはデータセットのprovenanceであり、Gitへ追加しません。summaryと各ファイルのSHA-256だけをモデルカードへ転記します。照合できない行も削除せず、`observation_not_found`または`photo_not_found`として残します。

公開中のモデルについては[`web/public/models/v0.1.0.md`](../web/public/models/v0.1.0.md)を参照してください。
