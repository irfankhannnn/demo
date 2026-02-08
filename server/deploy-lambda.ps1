param(
  [string]$Region = "ap-south-1",
  [string]$StackName = "cloudberry-dev-real-estate-agency",

  [string]$ArtifactBucket = "rewaro-cicd-artifacts",
  [string]$ArtifactPrefix = "cloudberry-dev-real-estate-agency",

  [string]$EnvironmentName = "dev",
  [string]$LambdaRuntime = "nodejs20.x",
  [int]$LambdaMemorySize = 512,
  [int]$LambdaTimeout = 300,

  [string]$DynamoDbTableName = "cloudberry-dev-real-estate-core",
  [string]$CrmDynamoDbTableName = "cloudberry-dev-real-estate-crm",
  [string]$AgencyConfigTableName = "cloudberry-dev-real-estate-agencies",
  [string]$EnquiriesTableNameCloudberry = "cloudberry-dev-real-estate-enquiries",
  [string]$AreasTableName = "cloudberry-dev-real-estate-areas",
  [string]$B2BLeadsTableName = "cloudberry-dev-real-estate-b2b-details",
  [string]$KhataTableName = "cloudberry-dev-real-estate-khata",
  [string]$NotificationsTableName = "cloudberry-dev-real-estate-notifications",
  [string]$DevelopersTableName = "cloudberry-dev-real-estate-developers",
  [string]$RealEstateAreasTableName = "cloudberry-dev-real-estate-communities",
  [string]$ProjectsTableName = "cloudberry-dev-real-estate-projects",
  [string]$S3BucketName = "cloudberry-dev-real-estate-agency-bucket",

  [string]$PublicApiDomainName = "services-api.cloudberrysolutions.in",
  [string]$PublicApiBasePath = "devrealestateagency",
  [string]$PublicApiStageName = "dev",

  [string]$CrmApiDomainName = "services-api.cloudberrysolutions.in",
  [string]$CrmApiBasePath = "devrealestatecrm",
  [string]$CrmApiStageName = "dev",

  [string]$LambdaCodeS3Bucket = "",
  [string]$LambdaCodeS3Key = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
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
  # ERR_MODULE_NOT_FOUND in Lambda during init (e.g. ./routes/auth.js).
  if (-not (Test-Path (Join-Path $buildDir "routes"))) {
    if (Test-Path (Join-Path $scriptDir "routes")) {
      Copy-Item (Join-Path $scriptDir "routes") -Destination (Join-Path $buildDir "routes") -Recurse -Force
    }
  }

  if (-not (Test-Path (Join-Path $buildDir "routes"))) {
    throw "Packaging error: 'routes' folder was not copied into build-lambda. Cannot deploy."
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

  $parameterOverrides = @(
    "EnvironmentName=$EnvironmentName",
    "LambdaRuntime=$LambdaRuntime",
    "LambdaMemorySize=$LambdaMemorySize",
    "LambdaTimeout=$LambdaTimeout",
    "DynamoDbTableName=$DynamoDbTableName",
    "CrmDynamoDbTableName=$CrmDynamoDbTableName",
    "AgencyConfigTableName=$AgencyConfigTableName",
    "EnquiriesTableNameCloudberry=$EnquiriesTableNameCloudberry",
    "AreasTableName=$AreasTableName",
    "B2BLeadsTableName=$B2BLeadsTableName",
    "KhataTableName=$KhataTableName",
    "NotificationsTableName=$NotificationsTableName",
    "DevelopersTableName=$DevelopersTableName",
    "RealEstateAreasTableName=$RealEstateAreasTableName",
    "ProjectsTableName=$ProjectsTableName",
    "S3BucketName=$S3BucketName",
    "LambdaCodeS3Bucket=$LambdaCodeS3Bucket",
    "LambdaCodeS3Key=$LambdaCodeS3Key",
    "PublicApiDomainName=$PublicApiDomainName",
    "PublicApiBasePath=$PublicApiBasePath",
    "PublicApiStageName=$PublicApiStageName",
    "CrmApiDomainName=$CrmApiDomainName",
    "CrmApiBasePath=$CrmApiBasePath",
    "CrmApiStageName=$CrmApiStageName"
  )

  aws cloudformation deploy `
    --region $Region `
    --stack-name $StackName `
    --template-file $templateFile `
    --capabilities CAPABILITY_NAMED_IAM `
    --parameter-overrides $parameterOverrides
  if ($LASTEXITCODE -ne 0) {
    throw "aws cloudformation deploy failed with exit code $LASTEXITCODE"
  }

  Write-Host "==> Forcing API Gateway deployments" -ForegroundColor Cyan
  $publicApiId = (aws cloudformation describe-stack-resources --region $Region --stack-name $StackName --logical-resource-id RealEstatePublicRestApi --query "StackResources[0].PhysicalResourceId" --output text)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($publicApiId) -or $publicApiId -eq "None") {
    throw "Failed to resolve RealEstatePublicRestApi PhysicalResourceId from stack resources"
  }

  $crmApiId = (aws cloudformation describe-stack-resources --region $Region --stack-name $StackName --logical-resource-id RealEstateCrmRestApi --query "StackResources[0].PhysicalResourceId" --output text)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($crmApiId) -or $crmApiId -eq "None") {
    throw "Failed to resolve RealEstateCrmRestApi PhysicalResourceId from stack resources"
  }

  $deployDesc = "deploy-lambda.ps1 $timestamp"
  aws apigateway create-deployment --region $Region --rest-api-id $publicApiId --stage-name $PublicApiStageName --description $deployDesc | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create API Gateway deployment for public API ($publicApiId)"
  }
  Start-Sleep -Seconds 5
  aws apigateway create-deployment --region $Region --rest-api-id $crmApiId --stage-name $CrmApiStageName --description $deployDesc | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create API Gateway deployment for CRM API ($crmApiId)"
  }

  Write-Host "==> Package complete" -ForegroundColor Green
  Write-Host "S3Bucket: $ArtifactBucket" -ForegroundColor Green
  Write-Host "S3Key:    $artifactKey" -ForegroundColor Green
  Write-Host "StackName: $StackName" -ForegroundColor Green
  Write-Host "PublicApiStage: $PublicApiStageName" -ForegroundColor Green
  Write-Host "CrmApiStage:    $CrmApiStageName" -ForegroundColor Green
}
finally {
  Pop-Location
}
