# Reply to paste into AWS case 178749035000906

Case: "Your account must be verified before you can add new CloudFront resources."
Status: Pending — AWS replied Thu 03 Sep 2026 09:21 IST, escalated to their
Specialized Service Team.

Direct link:
https://support.console.aws.amazon.com/support/home#/case/?displayId=178749035000906&language=en

Click **Reply**, paste everything below the line, leave Contact method on
**Web**, and press **Submit**.

---

Additional information relating to the same account verification block.

Amazon Bedrock model invocation is also failing on this account. Every InvokeModel and Converse call returns "ValidationException: Operation not allowed", in both ap-south-1 and us-east-1, for amazon.titan-embed-text-v2:0, apac.anthropic.claude-3-haiku-20240307-v1:0 and apac.amazon.nova-micro-v1:0. Example request ID: bbae278b-cd7d-4666-8804-182f02b10c1b

We have ruled out the usual causes. IAM simulate-principal-policy returns "allowed" for bedrock:InvokeModel, bedrock:CreateFoundationModelAgreement, aws-marketplace:Subscribe and aws-marketplace:ViewSubscriptions. ListFoundationModels shows amazon.titan-embed-text-v2:0 as ACTIVE with inferenceTypesSupported = [ON_DEMAND], so no inference profile is required; inference profiles were tried anyway for the Anthropic and Nova models with the same result. The Model access console page is retired and states that serverless foundation models are enabled automatically on first invocation. This account is standalone and not a member of any AWS Organization, so no Service Control Policy applies. A minimal valid request body gives the same error, whereas an invalid model identifier gives a different error ("The provided model identifier is invalid"), which shows the request reaches the service and passes model validation.

The Bedrock control plane works normally: ListFoundationModels and ListInferenceProfiles both succeed. Only model invocation is refused. Other services on this account work normally, including CloudFormation, Lambda and DynamoDB deployments completed today.

Since this case is already open for account verification blocking new CloudFront resources, we believe Bedrock invocation is blocked by the same pending verification. Please could the Specialized Service Team confirm whether the verification also covers Bedrock model invocation and ensure it is included when the account is verified. If it is a separate entitlement, please advise what is required.
