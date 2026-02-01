# Instance Provisioning 統合戦略分析

## 1. 現状分析 (`instance-provisioning` リポジトリ)

`instance-provisioning` リポジトリ (commit: `HEAD`) の調査結果を以下に示す。

### 構成要素
*   **Pulumi (TypeScript)**: `iac/pulumi/ec2`
    *   EC2インスタンス、EBS、Security Group等のAWSリソースを定義。
    *   設定 (`Pulumi.dev.yaml`) により、VPC ID、サブネットID、インスタンスタイプ等を注入する設計。
    *   `instanceType`, `ami`, `sshKeyPairName` などがパラメータ化されている。
*   **Ansible**: `iac/ansible`
    *   EC2起動後のソフトウェアプロビジョニング（Docker, SDKMANなど）を担当。
    *   SSM Session Manager 経由での実行を想定。
*   **Dockerfile**: **存在しない。** 現状はローカルマシンからの `pulumi up` 実行を前提としている。

## 2. 統合戦略: ECSタスクでの実行

親Issue (#1) の目標「ECSタスク内でPulumi実行するEC2インスタンスを生成」を達成するための戦略を提案する。

### 戦略概要
`instance-provisioning` の Pulumi コードを再利用し、実行環境（Pulumi CLI + Node.js）をコンテナ化して ECS Task として実行する。

### アプローチ: コンテナ化とパラメータ注入
1.  **Dockerイメージの作成**:
    *   Base Image: `pulumi/pulumi-nodejs` (公式イメージ) または `node` ベースに Pulumi CLI をインストール。
    *   `iac/pulumi/ec2` 配下のソースコードをイメージ内にコピー。
    *   `npm install` をビルド時に実行。
2.  **設定の注入**:
    *   ECSタスク定義の環境変数、または起動時のコマンド引数で `pulumi config set` 相当の値（VPC ID, Subnet ID等）を渡す。
    *   あるいは、S3やSSM Parameter Storeから設定ファイル (`Pulumi.dev.yaml`) をダウンロードするエントリーポイントスクリプトを用意する。
3.  **State管理**:
    *   Pulumi Backend として S3 を利用する（`pulumi login s3://<bucket>`）。
    *   State ロックのために DynamoDB を併用することを推奨。

### 認証・権限
*   **ECS Task Role**:
    *   EC2作成権限 (RunInstances, CreateTags, etc.)
    *   S3/DynamoDB (State管理用) へのアクセス権限
    *   IAM PassRole (EC2にRoleを割り当てる場合)

## 3. アーキテクチャ図 (Mermaid)

```mermaid
flowchart TD
    subgraph "ECS Cluster"
        Task[Pulumi Execution Task]
    end

    subgraph "AWS Cloud"
        EC2[Target EC2 Instance]
        S3[S3 Bucket (Pulumi State)]
        SSM[SSM Parameter Store (Config)]
    end

    Docker[Docker Image] --> Task
    Task -- "1. Load Config" --> SSM
    Task -- "2. Check State" --> S3
    Task -- "3. pulumi up" --> EC2

    note[Docker Image Contents:\n- Node.js / Pulumi CLI\n- instance-provisioning Code]
    Docker -.-> note
```

## 4. 推奨手順 (Next Steps)

1.  `instance-provisioning` リポジトリに `Dockerfile` を追加作成する。
2.  Dockerイメージをビルドし、ECRへプッシュするパイプラインを整備する（または手動確認）。
3.  ECSタスク定義を作成し、Fargateで `pulumi up` が実行できることを検証する。
