# Model release policy

モデル重みはソースコードのApache-2.0ライセンスの対象外です。各リリースには、モデルのバージョン、SHA-256、ライセンス、学習データの由来、対象種、評価結果を記録します。

現在Ubuntu環境にある甲虫データはMVP学習に再利用し、追加ダウンロードは行いません。ただし、その画像や学習済み重みを公開する前に、iNaturalistの利用条件と写真ごとのライセンスを確認します。確認が完了するまでデータセットと重みは公開リポジトリや公開R2に置きません。

Webアプリが読む `manifest.json` には最低限、`version`、`modelUrl`、`sha256`、`license`、`source`、`imageSize`、`classes` を含めます。モデルとmanifestは同じリリースとして更新し、古いWebアプリからも参照できる不変URLを使用します。
