<#
.SYNOPSIS
    Build, upload and deploy the Lead Desk property search API.

.DESCRIPTION
    Installs the Lambda's production dependencies, zips the folder, uploads the
    zip to S3 and runs `aws cloudformation deploy` against
    infra/property-search-api.yaml. Prints the Function URL and the two lines to
    paste into .env when it is done.

    The zip key carries a content hash, so a redeploy with unchanged code is a
    no-op and a redeploy with changed code always picks the new artefact up.
    CloudFormation will not notice a new zip under the same key, which is the
    usual reason a Lambda deploy silently ships the old bundle.

.EXAMPLE
    ./deploy.ps1 -ArtefactBucket my-deploy-bucket -TenantId abc-123 `
                 -ApiKey (Read-Host 'api key') -VectorIndexName property-vector-index

.EXAMPLE
    ./deploy.ps1 -ArtefactBucket my-deploy-bucket -TenantId abc-123 -ApiKey xxx -DryRun
#>
[CmdletBinding()]
param(
    # Existing S3 bucket in the same account and region that holds the zip.
    [Parameter(Mandatory = $true)][string]$ArtefactBucket,

    # The one tenant this API may read. Baked into the function's environment.
    [Parameter(Mandatory = $true)][string]$TenantId,

    # The x-api-key callers must send. Generate a long random one; this is the
    # only thing standing between the internet and the inventory.
    [Parameter(Mandatory = $true)][string]$ApiKey,

    [ValidateSet('dev', 'prod')][string]$Env = 'dev',
    [string]$Region = 'ap-south-1',
    [string]$PropertiesTableName = '',
    [string]$VectorIndexName = '',
    [string]$EmbeddingModelId = 'amazon.titan-embed-text-v2:0',
    [string]$AllowedOrigins = 'http://127.0.0.1:8931,http://localhost:8931',
    [string]$StackName = '',
    [string]$AwsProfile = '',

    # Print every step and stop before anything reaches AWS.
    [Alias('WhatIfOnly')][switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaDir = Join-Path $here 'lambda'
$templatePath = Join-Path $here 'property-search-api.yaml'

if (-not $PropertiesTableName) { $PropertiesTableName = "$Env-realestateflow-crm" }
if (-not $StackName) { $StackName = "$Env-lead-desk-property-search" }

$buildDir = Join-Path ([System.IO.Path]::GetTempPath()) "lead-desk-property-api-$Env"
$zipPath = Join-Path ([System.IO.Path]::GetTempPath()) "lead-desk-property-api-$Env.zip"

function Write-Step([string]$message) { Write-Host "==> $message" }

function Invoke-Aws([string[]]$ArgumentList) {
    $full = @('--region', $Region) + $ArgumentList
    if ($AwsProfile) { $full = @('--profile', $AwsProfile) + $full }
    if ($DryRun) {
        Write-Host "    [dry run] aws $($full -join ' ')"
        return ''
    }
    $output = & aws @full
    if ($LASTEXITCODE -ne 0) {
        throw "aws $($full -join ' ') failed with exit code $LASTEXITCODE"
    }
    return ($output -join "`n")
}

# ------------------------------------------------------------------ build --

Write-Step 'Installing Lambda dependencies'
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Path $buildDir | Out-Null
Copy-Item (Join-Path $lambdaDir 'index.mjs') $buildDir
Copy-Item (Join-Path $lambdaDir 'package.json') $buildDir

Push-Location $buildDir
try {
    # --omit=dev keeps the bundle to the three aws-sdk clients. No lockfile is
    # committed, so npm install rather than npm ci.
    & npm install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
}

Write-Step 'Packing the deployment zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $buildDir '*') -DestinationPath $zipPath -Force

$hash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.Substring(0, 12).ToLower()
$codeS3Key = "lead-desk-property-search/$Env/property-search-$hash.zip"
$zipSizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB)
Write-Host "    $zipPath ($zipSizeKb KB) -> s3://$ArtefactBucket/$codeS3Key"

# ----------------------------------------------------------------- deploy --

Write-Step "Uploading to s3://$ArtefactBucket/$codeS3Key"
Invoke-Aws @('s3', 'cp', $zipPath, "s3://$ArtefactBucket/$codeS3Key") | Out-Null

Write-Step "Deploying stack $StackName"
$parameters = @(
    "Env=$Env",
    "PropertiesTableName=$PropertiesTableName",
    "VectorIndexName=$VectorIndexName",
    "TenantId=$TenantId",
    "ApiKey=$ApiKey",
    "EmbeddingModelId=$EmbeddingModelId",
    "CodeS3Bucket=$ArtefactBucket",
    "CodeS3Key=$codeS3Key",
    "AllowedOrigins=$AllowedOrigins"
)
$deployArgs = @(
    'cloudformation', 'deploy',
    '--template-file', $templatePath,
    '--stack-name', $StackName,
    '--capabilities', 'CAPABILITY_NAMED_IAM',
    '--no-fail-on-empty-changeset',
    '--parameter-overrides'
) + $parameters
Invoke-Aws $deployArgs | Out-Null

if ($DryRun) {
    Write-Host ''
    Write-Host 'Dry run finished. Nothing was uploaded and no stack was touched.'
    Write-Host 'The zip was still built, so you can inspect it at:'
    Write-Host "  $zipPath"
    return
}

# ------------------------------------------------------------------ report --

Write-Step 'Reading the stack outputs'
$outputsJson = Invoke-Aws @(
    'cloudformation', 'describe-stacks',
    '--stack-name', $StackName,
    '--query', 'Stacks[0].Outputs',
    '--output', 'json'
)
$outputs = $outputsJson | ConvertFrom-Json
$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq 'ApiUrl' }).OutputValue
$functionName = ($outputs | Where-Object { $_.OutputKey -eq 'FunctionName' }).OutputValue
$apiUrl = $apiUrl.TrimEnd('/')

Write-Host ''
Write-Host "Function : $functionName"
Write-Host "Logs     : aws logs tail /aws/lambda/$functionName --follow --region $Region"
Write-Host "Health   : curl -H `"x-api-key: <your key>`" $apiUrl/health"
Write-Host ''
Write-Host 'Paste these two lines into .env beside the README:'
Write-Host ''
Write-Host "PROPERTY_API_BASE=$apiUrl"
Write-Host "PROPERTY_API_KEY=$ApiKey"
Write-Host ''
if (-not $VectorIndexName) {
    Write-Host 'No -VectorIndexName was given, so the function embeds the query and'
    Write-Host 'compares against descriptionVector itself, and scores on keywords for'
    Write-Host 'any listing that has no vector. Pass -VectorIndexName property-vector-index'
    Write-Host 'once the index exists in this environment.'
}
