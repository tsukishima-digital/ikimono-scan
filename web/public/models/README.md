# 判定モデルの配置

WebアプリはGit管理された`/models/manifest.json`を読み込み、manifestが参照するR2上のONNXモデルを端末内で実行します。

ONNXモデルはGitリポジトリへ追加しません。公開前に、モデルのライセンス、学習データの出典、再配布条件を確認してください。

各リリースの配布条件、学習データ監査、評価結果はバージョン別モデルカードへ記録します。現在のモデルカードは[`v0.1.0.md`](v0.1.0.md)です。

ローカル成果物は`artifacts/models/`へ生成します。`LICENSE`と`SOURCE`には確認済みの内容を指定してください。未確認の成果物はR2へアップロードしないでください。

和名はiNaturalistの分類群IDをキーにした`ml/taxonomy/ja.json`からmanifestへ結合されます。モデルのクラスを更新したときは、先に分類群カタログを更新してください。

```console
ikimono-scan-ml refresh-taxonomy-ja \
  --checkpoint /path/to/best.pt \
  --output ml/taxonomy/ja.json
```

具体的な変換・アップロード手順は[`docs/model-release.md`](../../../docs/model-release.md)に記載しています。
