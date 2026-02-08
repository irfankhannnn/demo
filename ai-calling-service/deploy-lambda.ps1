param(
  [string]$Region = "ap-south-1",
  [string]$StackName = "cloudberry-dev-ai-calling-service",

  [string]$ArtifactBucket = "rewaro-cicd-artifacts",
  [string]$ArtifactPrefix = "cloudberry-dev-ai-calling-service",

  [string]$EnvironmentName = "dev",
  [string]$LambdaRuntime = "nodejs20.x",
  [int]$LambdaMemorySize = 512,
  [int]$LambdaTimeout = 30,

  [string]$AICallingTableName = "cloudberry-dev-ai-calling-data",
  [string]$AICallingKnowledgeBucket = "cloudberry-dev-ai-calling-knowledge",
  [string]$AICallingRecordingsBucket = "cloudberry-dev-ai-calling-recordings",

  [string]$CrmInternalApiUrl = "https://services-api.cloudberrysolutions.in/devrealestatecrm",
  [string]$CrmInternalApiKey = "SMbVpgislJ5u1NgoYEH701Sor2ls9aAvYvqbGSU2",

  [string]$ExotelApiKey = "1fe0bf7f3e6957b82ca4718bf6d9501ddade3833716b34e5",
  [string]$ExotelApiToken = "69b4d9e40998ca2c21509ea51b34c7fa5c49d86e4430c0af",
  [string]$ExotelSid = "cloudberry1",

  [string]$ElevenLabsApiKey = "sk_18ad6e7e384a6fb5bed9d4e0f6c3f5f396fd744414e83bc1",
  [string]$BedrockKnowledgeBaseId = "TOVIEJ5ZPS",

  [string]$WebhookBaseUrl = "https://services-api.cloudberrysolutions.in/devrealestateagencyai",

  [string]$CustomDomainName = "services-api.cloudberrysolutions.in",
  [string]$CustomDomainBasePath = "devrealestateagencyai",

  [string]$LambdaCodeS3Bucket = "",
  [string]$LambdaCodeS3Key = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
  # Validate required secrets are provided at runtime (do not hardcode in repo)
  if ([string]::IsNullOrWhiteSpace($CrmInternalApiKey)) {
    throw "Missing required parameter: CrmInternalApiKey"
  }
  if ([string]::IsNullOrWhiteSpace($ExotelApiKey)) {
    throw "Missing required parameter: ExotelApiKey"
  }
  if ([string]::IsNullOrWhiteSpace($ExotelApiToken)) {
    throw "Missing required parameter: ExotelApiToken"
  }
  if ([string]::IsNullOrWhiteSpace($ExotelSid)) {
    throw "Missing required parameter: ExotelSid"
  }
  if ([string]::IsNullOrWhiteSpace($ElevenLabsApiKey)) {
    throw "Missing required parameter: ElevenLabsApiKey"
  }

  Write-Host "==> Preparing Lambda build directory" -ForegroundColor Cyan
  $buildDir = Join-Path $scriptDir "build-lambda"
  if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $buildDir | Out-Null

  Write-Host "==> Copying backend source into build directory" -ForegroundColor Cyan
  $excludedNames = @("build-lambda", "node_modules")
  Get-ChildItem -Path $scriptDir -Force | Where-Object {
    $_.Name -notin $excludedNames
  } | ForEach-Object {
    Copy-Item $_.FullName -Destination (Join-Path $buildDir $_.Name) -Recurse -Force
  }

  # Ensure critical folders are present in the build output. Missing these causes
  # ERR_MODULE_NOT_FOUND in Lambda during init (e.g. ./routes/calls.js).
  if (-not (Test-Path (Join-Path $buildDir "src"))) {
    if (Test-Path (Join-Path $scriptDir "src")) {
      Copy-Item (Join-Path $scriptDir "src") -Destination (Join-Path $buildDir "src") -Recurse -Force
    }
  }

  if (-not (Test-Path (Join-Path $buildDir "src"))) {
    throw "Packaging error: 'src' folder was not copied into build-lambda. Cannot deploy."
  }

  Write-Host "==> Installing production dependencies" -ForegroundColor Cyan
  Push-Location $buildDir
  $installSucceeded = $false
  if (Test-Path "package-lock.json") {
    npm ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -eq 0) {
      $installSucceeded = $true
    } else {
      Write-Host "==> npm ci failed; falling back to npm install" -ForegroundColor Yellow
    }
  }

  if (-not $installSucceeded) {
    npm install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed with exit code $LASTEXITCODE"
    }
  }
  Pop-Location

  Write-Host "==> Creating deployment zip" -ForegroundColor Cyan
  $timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
  $zipFile = Join-Path $scriptDir "build-lambda-$timestamp.zip"
  if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
  }

  Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
  [System.IO.Compression.ZipFile]::CreateFromDirectory($buildDir, $zipFile)

  $artifactKey = "$ArtifactPrefix/build-lambda-$timestamp.zip"
  Write-Host "==> Uploading artifact to s3://$ArtifactBucket/$artifactKey" -ForegroundColor Cyan
  aws s3 cp $zipFile "s3://$ArtifactBucket/$artifactKey" --region $Region
  if ($LASTEXITCODE -ne 0) {
    throw "aws s3 cp failed with exit code $LASTEXITCODE"
  }

  if ([string]::IsNullOrWhiteSpace($LambdaCodeS3Bucket)) {
    $LambdaCodeS3Bucket = $ArtifactBucket
  }
  if ([string]::IsNullOrWhiteSpace($LambdaCodeS3Key)) {
    $LambdaCodeS3Key = $artifactKey
  }

  Write-Host "==> Deploying CloudFormation stack: $StackName" -ForegroundColor Cyan
  $templateFile = Join-Path $scriptDir "cfn-template.yaml"
  if (-not (Test-Path $templateFile)) {
    throw "CloudFormation template not found at $templateFile"
  }

  # Build parameter overrides
  $parameterOverrides = @(
    "EnvironmentName=$EnvironmentName",
    "LambdaRuntime=$LambdaRuntime",
    "LambdaMemorySize=$LambdaMemorySize",
    "LambdaTimeout=$LambdaTimeout",
    "AICallingTableName=$AICallingTableName",
    "AICallingKnowledgeBucket=$AICallingKnowledgeBucket",
    "LambdaCodeS3Bucket=$LambdaCodeS3Bucket",
    "LambdaCodeS3Key=$LambdaCodeS3Key",
    "CrmInternalApiUrl=$CrmInternalApiUrl"
  )

  # Add optional parameters only if they have values
  if (-not [string]::IsNullOrWhiteSpace($CrmInternalApiKey)) {
    $parameterOverrides += "CrmInternalApiKey=$CrmInternalApiKey"
  }
  if (-not [string]::IsNullOrWhiteSpace($ExotelApiKey)) {
    $parameterOverrides += "ExotelApiKey=$ExotelApiKey"
  }
  if (-not [string]::IsNullOrWhiteSpace($ExotelApiToken)) {
    $parameterOverrides += "ExotelApiToken=$ExotelApiToken"
  }
  if (-not [string]::IsNullOrWhiteSpace($ExotelSid)) {
    $parameterOverrides += "ExotelSid=$ExotelSid"
  }
  if (-not [string]::IsNullOrWhiteSpace($ElevenLabsApiKey)) {
    $parameterOverrides += "ElevenLabsApiKey=$ElevenLabsApiKey"
  }
  if (-not [string]::IsNullOrWhiteSpace($BedrockKnowledgeBaseId)) {
    $parameterOverrides += "BedrockKnowledgeBaseId=$BedrockKnowledgeBaseId"
  }
  if (-not [string]::IsNullOrWhiteSpace($CustomDomainName)) {
    $parameterOverrides += "CustomDomainName=$CustomDomainName"
  }
  if (-not [string]::IsNullOrWhiteSpace($CustomDomainBasePath)) {
    $parameterOverrides += "CustomDomainBasePath=$CustomDomainBasePath"
  }

  aws cloudformation deploy `
    --region $Region `
    --stack-name $StackName `
    --template-file $templateFile `
    --capabilities CAPABILITY_NAMED_IAM `
    --parameter-overrides $parameterOverrides
  if ($LASTEXITCODE -ne 0) {
    throw "aws cloudformation deploy failed with exit code $LASTEXITCODE"
  }

  Write-Host "==> Forcing API Gateway deployment" -ForegroundColor Cyan
  $apiId = (aws cloudformation describe-stack-resources --region $Region --stack-name $StackName --logical-resource-id AICallingApi --query "StackResources[0].PhysicalResourceId" --output text)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($apiId) -or $apiId -eq "None") {
    throw "Failed to resolve AICallingApi PhysicalResourceId from stack resources"
  }

  $deployDesc = "deploy-lambda.ps1 $timestamp"
  aws apigateway create-deployment --region $Region --rest-api-id $apiId --stage-name $EnvironmentName --description $deployDesc | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create API Gateway deployment for AI Calling API ($apiId)"
  }

  Write-Host "==> Package complete" -ForegroundColor Green
  Write-Host "S3Bucket: $ArtifactBucket" -ForegroundColor Green
  Write-Host "S3Key:    $artifactKey" -ForegroundColor Green
  Write-Host "StackName: $StackName" -ForegroundColor Green
  Write-Host "ApiStage: $EnvironmentName" -ForegroundColor Green
  
  # Get the API URL for easy reference
  if (-not [string]::IsNullOrWhiteSpace($CustomDomainName)) {
    $apiUrl = "https://$CustomDomainName/$CustomDomainBasePath"
  } else {
    $apiUrl = "https://$apiId.execute-api.$Region.amazonaws.com/$EnvironmentName"
  }
  Write-Host "ApiUrl:   $apiUrl" -ForegroundColor Green
  Write-Host ""
  Write-Host "==> Next Steps:" -ForegroundColor Yellow
  Write-Host "1. Update frontend .env with: VITE_AI_CALLING_API_URL=$apiUrl" -ForegroundColor Yellow
  Write-Host "2. Configure agent settings at: $apiUrl/api/ai-calling/config/agent" -ForegroundColor Yellow
  Write-Host "3. Upload knowledge documents at: $apiUrl/api/ai-calling/knowledge" -ForegroundColor Yellow
  if (-not [string]::IsNullOrWhiteSpace($CustomDomainName)) {
    Write-Host "4. Configure DNS: Create CNAME record for $CustomDomainName pointing to $apiId.execute-api.$Region.amazonaws.com" -ForegroundColor Yellow
  }
}
finally {
  Pop-Location
}
