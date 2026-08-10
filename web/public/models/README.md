# 判定モデルの配置

Webアプリは`/models/manifest.json`を読み込み、manifestが参照するONNXモデルを端末内で実行します。

モデル本体と生成済みmanifestはリリース成果物として配信し、Gitリポジトリには追加しません。公開前に、モデルのライセンス、学習データの出典、再配布条件を確認してください。

ローカル検証用の成果物は、次のコマンドでこのディレクトリへ生成します。`--license`と`--source`は確認済みの内容を指定してください。未確認の成果物はローカル検証に限り、公開しないでください。

和名はiNaturalistの分類群IDをキーにした`ml/taxonomy/ja.json`からmanifestへ結合されます。モデルのクラスを更新したときは、先に分類群カタログを更新してください。

```console
ikimono-scan-ml refresh-taxonomy-ja \
  --checkpoint /path/to/best.pt \
  --output ml/taxonomy/ja.json
```

```console
ikimono-scan-ml-export-web \
  --checkpoint /path/to/best.pt \
  --output-dir web/public/models \
  --version 0.1.0 \
  --license UNPUBLISHED \
  --source "internal checkpoint"
```
