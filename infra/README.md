# Infrastructure

Cloudflare上のリソースはTerraformで管理します。`bootstrap`はstate専用R2 bucket、`storage`はモデル用R2 bucket、`production`はWorkerとCustom Domain、`preview`は開発用Tunnel・DNS・Accessを所有します。state bucketとモデルbucketは資格情報も用途も分離してください。

backendはR2のS3互換APIを使います。R2にBucket Versioningがないため、applyの前後にstateを別keyへ保存します。backend credentialsは環境変数だけから読み込み、Terraform設定やplanへ含めません。

初回だけstate bucketがまだ存在しないため、`task infra:bootstrap`が同一のTerraform設定を一時的なlocal backendでapplyし、そのstateを直ちにR2へ移します。それ以降はR2 backendだけを使用します。このコマンドもCloudflareを変更するため、通常の検証では実行しません。

必要な環境変数は`.env.example`に記載しています。通常の確認には以下を使います。

```console
task infra:validate
task infra:bootstrap:plan
task infra:plan
```

`task deploy`はmain上の公開workflowを、`task unpublish`はCustom Domainを外す公開停止workflowを起動します。ローカルから本番applyは実行せず、workflowだけが保存済みplanを使います。通常のdeployはCustom Domainを再作成するため、公開再開にも使えます。

`task preview:provision`は`dev.ikimono-scan.app`の開発用リソースを作成するworkflowを起動します。作成後はCloudflareへログイン済みの端末で`task dev:mobile`を実行すると、Accessで保護されたHTTPS経路からローカルUIを確認できます。

preview workflowは専用のGitHub Secret `CLOUDFLARE_PREVIEW_API_TOKEN`を使用します。このCloudflare API tokenには、開発用リソースの作成に必要なCloudflare Tunnel Edit、Access: Apps and Policies Edit、対象zoneのDNS EditとZone Readだけを付与します。本番用の`CLOUDFLARE_API_TOKEN`とは分離します。AccessはCloudflareアカウントのメンバーだけを許可し、共有パスワードは使用しません。
