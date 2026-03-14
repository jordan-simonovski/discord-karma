# GitHub OIDC Setup (AWS Deploy)

This project deploys with GitHub Actions using OpenID Connect (OIDC), so no long-lived AWS keys are stored in GitHub.

## Prerequisites

- AWS account access with permission to create IAM roles/providers and deploy CDK stacks.
- GitHub repository admin access for variables and secrets.
- Local environment with Node.js and project dependencies installed.

## 1) Deploy the GitHub OIDC Role Stack

From the project root, replace `owner/repo` with your repository path:

```bash
npm ci
npm run build
npx cdk deploy DiscordKarmaGithubOidcRoleStack -c githubRepo=owner/repo --require-approval never
```

This stack creates:

- IAM OIDC provider for `token.actions.githubusercontent.com`
- IAM deploy role trusted by your `main` branch
- Stack output: `GitHubActionsDeployRoleArn`

## 2) Configure GitHub Repository Settings

In GitHub: **Settings -> Secrets and variables -> Actions**

- Add Variables:
  - `AWS_REGION` (example: `us-east-1`)
  - `AWS_ACCOUNT_ID` (your 12-digit AWS account ID)
- Add Secret:
  - `AWS_DEPLOY_ROLE_ARN` = output `GitHubActionsDeployRoleArn`
  - `DISCORD_PUBLIC_KEY` = Discord application public key from Developer Portal

## 3) Verify Workflow Permissions

The workflow `.github/workflows/deploy.yml` already includes:

- `permissions.id-token: write` (required for OIDC)
- `permissions.contents: read`

Do not remove `id-token: write` or role assumption will fail.

## 4) Bootstrap CDK in Target Account/Region

Run once per account/region:

```bash
npx cdk bootstrap aws://ACCOUNT_ID/REGION
```

Example:

```bash
npx cdk bootstrap aws://123456789012/us-east-1
```

## 5) Trigger Deployment

- Push to `main`, or
- Manually run the `Deploy` workflow from GitHub Actions UI.

The workflow runs:

1. `npm ci`
2. `npm test`
3. `npm run build`
4. `cdk deploy DiscordKarmaStack`
   - with `DiscordPublicKey` stack parameter from secret

## Troubleshooting

- `Not authorized to perform sts:AssumeRoleWithWebIdentity`
  - Check `AWS_DEPLOY_ROLE_ARN` secret and role trust policy.
  - Confirm the push is on `main` (trust is restricted to `refs/heads/main`).
- `No OpenIDConnect provider found`
  - Re-deploy `DiscordKarmaGithubOidcRoleStack`.
- `SSM parameter /cdk-bootstrap/... not found`
  - Run CDK bootstrap for the same account/region used by the workflow.
