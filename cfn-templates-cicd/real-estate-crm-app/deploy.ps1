# =============================================================================
# CRM Frontend (real-estate-crm-app) — S3 + CloudFront Deploy Script
# =============================================================================
# Usage:
#   .\deploy.ps1 -Environment nonprod   (run from cfn-templates-cicd/real-estate-crm-app/)
#   .\deploy.ps1 -Environment prod
#
# Reads deploy-time config (bucket name, custom domain, etc.) AND the
# VITE_* build-time config from a single environment file at the project
# root: .env.nonprod or .env.prod (copy from .env.nonprod.sample /
# .env.prod.sample). The build step (`vite build --mode <Environment>`)
# loads the same file automatically for VITE_* variables.
#
# Requires: AWS CLI configured with credentials that can manage S3,
# CloudFormation and CloudFront in the target account.
#
# NOTE: This script lives in cfn-templates-cicd/real-estate-crm-app/ but
# builds and deploys the real-estate-crm-app/ frontend. $projectDir is
# resolved two levels up + into real-estate-crm-app/ (not just one level
# up) to reach the actual project root (package.json, .env.<env>, dist/).
# =============================================================================

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('nonprod', 'prod')]
  [string]$Environment,

  [string]$Region = "ap-south-1",
  [string]$StackName = "",

  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$SkipCfnDeploy,
  [switch]$SkipSync,
  [switch]$SkipInvalidate
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path $scriptDir "..\..\real-estate-crm-app" | Resolve-Path | Select-Object -ExpandProperty Path
Push-Location $projectDir

try {
  # ---------------------------------------------------------------------
  # 1. Load .env.<Environment>
  # ---------------------------------------------------------------------
  $envFile = Join-Path $projectDir ".env.$Environment"
  if (-not (Test-Path $envFile)) {
    throw "Environment file not found: $envFile`nCopy .env.$Environment.sample to .env.$Environment and fill in the values."
  }

  Write-Host "==> Loading $envFile" -ForegroundColor Cyan
  $envVars = @{}
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if ($value.Length -ge 2 -and (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $envVars[$key] = $value
  }

  function Get-EnvVar {
    param([string]$Name, [string]$Default = "")
    if ($envVars.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($envVars[$Name])) {
      return $envVars[$Name]
    }
    return $Default
  }

  $deployRegion = Get-EnvVar "AWS_REGION" $Region
  $bucketName = Get-EnvVar "FRONTEND_S3_BUCKET_NAME"
  $customDomainName = Get-EnvVar "FRONTEND_CUSTOM_DOMAIN_NAME"
  $acmCertificateArn = Get-EnvVar "FRONTEND_ACM_CERTIFICATE_ARN"
  $hostedZoneId = Get-EnvVar "FRONTEND_HOSTED_ZONE_ID"
  $priceClass = Get-EnvVar "FRONTEND_PRICE_CLASS" "PriceClass_200"
  $wafWebAclArn = Get-EnvVar "FRONTEND_WAF_WEB_ACL_ARN"

  if ([string]::IsNullOrWhiteSpace($StackName)) {
    $StackName = "cloudberry-$Environment-crm-frontend"
  }

  if ([string]::IsNullOrWhiteSpace($bucketName)) {
    throw "Missing required variable FRONTEND_S3_BUCKET_NAME in $envFile"
  }

  if (-not [string]::IsNullOrWhiteSpace($customDomainName) -and [string]::IsNullOrWhiteSpace($acmCertificateArn)) {
    throw "FRONTEND_CUSTOM_DOMAIN_NAME is set but FRONTEND_ACM_CERTIFICATE_ARN is missing in $envFile (cert must be issued in us-east-1)"
  }

  Write-Host "Environment: $Environment" -ForegroundColor Cyan
  Write-Host "Region:      $deployRegion" -ForegroundColor Cyan
  Write-Host "Stack:       $StackName" -ForegroundColor Cyan
  Write-Host "Bucket:      $bucketName" -ForegroundColor Cyan
  Write-Host ""

  # ---------------------------------------------------------------------
  # 2. Install dependencies
  # ---------------------------------------------------------------------
  if (-not $SkipInstall) {
    Write-Host "==> Installing dependencies" -ForegroundColor Cyan
    if (Test-Path (Join-Path $projectDir "package-lock.json")) {
      npm ci
    }
    else {
      npm install
    }
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
  }

  # ---------------------------------------------------------------------
  # 3. Build (vite loads .env.<Environment> automatically via --mode)
  # ---------------------------------------------------------------------
  $distDir = Join-Path $projectDir "dist"
  if (-not $SkipBuild) {
    Write-Host "==> Building frontend (vite build --mode $Environment)" -ForegroundColor Cyan
    if (Test-Path $distDir) {
      Remove-Item $distDir -Recurse -Force
    }
    npx vite build --mode $Environment
    if ($LASTEXITCODE -ne 0) { throw "vite build failed with exit code $LASTEXITCODE" }
  }

  if (-not (Test-Path $distDir)) {
    throw "Build output not found at $distDir. Run without -SkipBuild first."
  }

  # ---------------------------------------------------------------------
  # 4. Deploy CloudFormation stack (S3 + CloudFront)
  # ---------------------------------------------------------------------
  $templateFile = Join-Path $scriptDir "cfn-frontend.yaml"
  if (-not (Test-Path $templateFile)) {
    throw "CloudFormation template not found at $templateFile"
  }

  if (-not $SkipCfnDeploy) {
    Write-Host "==> Deploying CloudFormation stack: $StackName" -ForegroundColor Cyan

    $parameterOverrides = @(
      "EnvironmentName=$Environment",
      "BucketName=$bucketName",
      "PriceClass=$priceClass"
    )
    if (-not [string]::IsNullOrWhiteSpace($customDomainName)) {
      $parameterOverrides += "CustomDomainName=$customDomainName"
    }
    if (-not [string]::IsNullOrWhiteSpace($acmCertificateArn)) {
      $parameterOverrides += "AcmCertificateArn=$acmCertificateArn"
    }
    if (-not [string]::IsNullOrWhiteSpace($hostedZoneId)) {
      $parameterOverrides += "HostedZoneId=$hostedZoneId"
    }
    if (-not [string]::IsNullOrWhiteSpace($wafWebAclArn)) {
      $parameterOverrides += "WafWebAclArn=$wafWebAclArn"
    }

    aws cloudformation deploy `
      --region $deployRegion `
      --stack-name $StackName `
      --template-file $templateFile `
      --no-fail-on-empty-changeset `
      --parameter-overrides $parameterOverrides
    if ($LASTEXITCODE -ne 0) { throw "aws cloudformation deploy failed with exit code $LASTEXITCODE" }
  }

  # ---------------------------------------------------------------------
  # 5. Resolve stack outputs
  # ---------------------------------------------------------------------
  Write-Host "==> Resolving stack outputs" -ForegroundColor Cyan
  $resolvedBucket = aws cloudformation describe-stacks --region $deployRegion --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text
  $distributionId = aws cloudformation describe-stacks --region $deployRegion --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text
  $distributionDomain = aws cloudformation describe-stacks --region $deployRegion --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text

  if ([string]::IsNullOrWhiteSpace($resolvedBucket) -or $resolvedBucket -eq "None") {
    $resolvedBucket = $bucketName
  }

  # ---------------------------------------------------------------------
  # 6. Sync dist/ to S3
  # ---------------------------------------------------------------------
  if (-not $SkipSync) {
    Write-Host "==> Syncing dist/ to s3://$resolvedBucket" -ForegroundColor Cyan

    # Hashed, immutable build assets: cache aggressively
    aws s3 sync $distDir "s3://$resolvedBucket" `
      --region $deployRegion `
      --delete `
      --cache-control "public,max-age=31536000,immutable" `
      --exclude "index.html"
    if ($LASTEXITCODE -ne 0) { throw "aws s3 sync failed with exit code $LASTEXITCODE" }

    # index.html: never cache, so a new deploy is visible immediately
    $indexPath = Join-Path $distDir "index.html"
    if (Test-Path $indexPath) {
      aws s3 cp $indexPath "s3://$resolvedBucket/index.html" `
        --region $deployRegion `
        --cache-control "public,max-age=0,must-revalidate"
      if ($LASTEXITCODE -ne 0) { throw "aws s3 cp index.html failed with exit code $LASTEXITCODE" }
    }
  }

  # ---------------------------------------------------------------------
  # 7. Invalidate CloudFront cache
  # ---------------------------------------------------------------------
  if (-not $SkipInvalidate -and -not [string]::IsNullOrWhiteSpace($distributionId) -and $distributionId -ne "None") {
    Write-Host "==> Invalidating CloudFront distribution $distributionId" -ForegroundColor Cyan
    aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "aws cloudfront create-invalidation failed with exit code $LASTEXITCODE" }
  }

  Write-Host ""
  Write-Host "==> Deploy complete" -ForegroundColor Green
  Write-Host "Environment:  $Environment" -ForegroundColor Green
  Write-Host "Bucket:       $resolvedBucket" -ForegroundColor Green
  Write-Host "Distribution: $distributionId" -ForegroundColor Green
  if (-not [string]::IsNullOrWhiteSpace($distributionDomain) -and $distributionDomain -ne "None") {
    Write-Host "URL:          https://$distributionDomain" -ForegroundColor Green
  }
  if (-not [string]::IsNullOrWhiteSpace($customDomainName)) {
    Write-Host "Custom URL:   https://$customDomainName" -ForegroundColor Green
  }
}
finally {
  Pop-Location
}
