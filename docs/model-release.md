# Model release policy

モデル重みはソースコードのApache-2.0ライセンスの対象外です。各リリースには、モデルのバージョン、SHA-256、ライセンス、学習データの由来、対象種、評価結果を記録します。

現在Ubuntu環境にある甲虫データはMVP学習に再利用し、追加ダウンロードは行いません。ただし、その画像や学習済み重みを公開する前に、iNaturalistの利用条件と写真ごとのライセンスを確認します。確認が完了するまでデータセットと重みは公開リポジトリや公開R2に置きません。

Webアプリが読む `manifest.json` には最低限、`version`、`modelUrl`、`sha256`、`license`、`source`、`imageSize`、`classes` を含めます。ONNXはバージョン付きの不変URLでR2に置き、manifestはGitで管理します。同じURLの重みは上書きせず、修正時は新しいバージョンを発行します。

変換とアップロードには次のコマンドを使います。

```console
task model:export \
  CHECKPOINT=/path/to/best.pt \
  VERSION=0.1.0 \
  LICENSE=CC-BY-NC-4.0 \
  SOURCE="audited iNaturalist observations"

task model:upload BUNDLE_DIR=artifacts/models/v0.1.0
```

`model:export`はcheckpointからONNXとmanifestを生成し、公開条件とSHA-256を検証します。`model:upload`は同名オブジェクトが未公開であることを確認してONNXだけをR2へ送り、公開URLから再取得したSHA-256が一致した場合に限り、Git管理対象のmanifestを更新します。両方を続けて行う場合は`task model:prepare-and-upload`を使います。

manifestの変更はPRで確認し、mainへ反映した後に`task deploy`で通常のGitHub Actionsデプロイを起動します。これにより、重みの転送とユーザー向けのモデル切り替えを分離します。`UNPUBLISHED`の重みはアップロードできません。
