[CmdletBinding()]
param(
  [string]$ProjectId = "keenvi-studio",

  [string]$SupabaseUrl = "",
  [string]$R2PublicUrl = "",
  [string]$R2BucketName = "",

  [string]$ServiceName = "keenvi-studio-api",
  [string]$ServiceAccount = "",
  [string]$Region = "asia-east1",
  [string]$SupabaseAnonKeySecret = "keenvi-supabase-anon-key",
  [string]$AdminEmailsSecret = "keenvi-admin-emails",
  [string]$R2AccountIdSecret = "keenvi-r2-account-id",
  [string]$R2AccessKeyIdSecret = "keenvi-r2-access-key-id",
  [string]$R2SecretAccessKeySecret = "keenvi-r2-secret-access-key",
  [string]$EnvFile = ".env.local",
  [string]$GcloudPath = "C:\Users\ucsur\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$ErrorActionPreference = "Stop"

if (-not $ServiceAccount) {
  $ServiceAccount = "$ServiceName@$ProjectId.iam.gserviceaccount.com"
}

if (-not (Test-Path -LiteralPath $GcloudPath)) {
  throw "Google Cloud CLI not found: $GcloudPath"
}

$environmentValues = @{}
if (Test-Path -LiteralPath $EnvFile) {
  foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $key = $Matches[1]
      $value = $Matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $environmentValues[$key] = $value
    }
  }
}

if (-not $SupabaseUrl) { $SupabaseUrl = $environmentValues["VITE_SUPABASE_URL"] }
if (-not $R2PublicUrl) { $R2PublicUrl = $environmentValues["VITE_R2_PUBLIC_URL"] }
if (-not $R2BucketName) { $R2BucketName = $environmentValues["R2_BUCKET_NAME"] }
if (-not $SupabaseUrl -or -not $R2PublicUrl -or -not $R2BucketName) {
  throw "SupabaseUrl, R2PublicUrl, and R2BucketName are required in parameters or $EnvFile."
}

$activeAccount = & $GcloudPath auth list --filter=status:ACTIVE --format="value(account)" --quiet
if (-not $activeAccount) {
  throw "No active gcloud account. Run 'gcloud auth login' first."
}

$publicEnvironment = "NODE_ENV=production,VITE_SUPABASE_URL=$SupabaseUrl,VITE_R2_PUBLIC_URL=$R2PublicUrl,R2_BUCKET_NAME=$R2BucketName"
$secretEnvironment = "VITE_SUPABASE_ANON_KEY=$SupabaseAnonKeySecret`:latest,ADMIN_EMAILS=$AdminEmailsSecret`:latest,R2_ACCOUNT_ID=$R2AccountIdSecret`:latest,R2_ACCESS_KEY_ID=$R2AccessKeyIdSecret`:latest,R2_SECRET_ACCESS_KEY=$R2SecretAccessKeySecret`:latest"

$deployArguments = @(
  "run", "deploy", $ServiceName,
  "--project", $ProjectId,
  "--region", $Region,
  "--source", ".",
  "--port", "8080",
  "--allow-unauthenticated",
  "--service-account", $ServiceAccount,
  "--min-instances", "0",
  "--max-instances", "3",
  "--concurrency", "20",
  "--timeout", "60",
  "--memory", "1Gi",
  "--cpu", "1",
  "--set-env-vars", $publicEnvironment,
  "--set-secrets", $secretEnvironment,
  "--quiet"
)

& $GcloudPath @deployArguments
if ($LASTEXITCODE -ne 0) {
  throw "Cloud Run deployment failed with exit code $LASTEXITCODE."
}

$serviceUrl = & $GcloudPath run services describe $ServiceName `
  --project $ProjectId `
  --region $Region `
  --format="value(status.url)"

Write-Output "Cloud Run service URL: $serviceUrl"
Write-Output "Health check: $serviceUrl/api/health"
