# Infrastructure

Cloudflare上の本番リソースはTerraformで管理します。`bootstrap`はstate専用R2 bucket、`storage`はモデル用R2 bucket、`production`はWorkerとCustom Domainを所有します。state bucketとモデルbucketは資格情報も用途も分離してください。

backendはR2のS3互換APIを使います。R2にBucket Versioningがないため、applyの前後にstateを別keyへ保存します。backend credentialsは環境変数だけから読み込み、Terraform設定やplanへ含めません。

初回だけstate bucketがまだ存在しないため、`task infra:bootstrap`が同一のTerraform設定を一時的なlocal backendでapplyし、そのstateを直ちにR2へ移します。それ以降はR2 backendだけを使用します。このコマンドもCloudflareを変更するため、通常の検証では実行しません。

必要な環境変数は`.env.example`に記載しています。通常の確認には以下を使います。

```console
task infra:validate
task infra:bootstrap:plan
task infra:plan
```

`task deploy`は用意しません。本番applyは、main上のcommitに対して手動起動するGitHub Actionsだけが保存済みplanを使って実行します。
