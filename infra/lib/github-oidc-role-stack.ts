import { Stack, type StackProps, CfnOutput } from "aws-cdk-lib";
import {
  Effect,
  FederatedPrincipal,
  ManagedPolicy,
  OpenIdConnectProvider,
  PolicyStatement,
  Role
} from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export interface GitHubOidcRoleStackProps extends StackProps {
  githubRepo: string;
}

export class GitHubOidcRoleStack extends Stack {
  public constructor(
    scope: Construct,
    id: string,
    props: GitHubOidcRoleStackProps
  ) {
    super(scope, id, props);

    const provider = new OpenIdConnectProvider(this, "GitHubOidcProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"]
    });

    const deployRole = new Role(this, "GitHubActionsDeployRole", {
      assumedBy: new FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:ref:refs/heads/main`
          }
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Assumed by GitHub Actions via OIDC for CDK deployment"
    });

    deployRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    );

    deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["sts:GetCallerIdentity"],
        resources: ["*"]
      })
    );

    new CfnOutput(this, "GitHubActionsDeployRoleArn", {
      value: deployRole.roleArn
    });
  }
}
