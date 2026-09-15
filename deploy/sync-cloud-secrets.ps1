[CmdletBinding()]
param(
  [string]$ProjectId = "keenvi-studio",
  [string]$EnvFile = ".env.local",
  [string]$GcloudPath = "C:\Users\ucsur\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Environment file not found: $EnvFile"
}
if (-not (Test-Path -LiteralPath $GcloudPath)) {
  throw "Google Cloud CLI not found: $GcloudPath"
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
    $key = $Matches[1]
    $value = $Matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
  }
}

$secretMap = [ordered]@{
  "keenvi-supabase-anon-key" = "VITE_SUPABASE_ANON_KEY"
  "keenvi-admin-emails" = "ADMIN_EMAILS"
  "keenvi-r2-account-id" = "R2_ACCOUNT_ID"
  "keenvi-r2-access-key-id" = "R2_ACCESS_KEY_ID"
  "keenvi-r2-secret-access-key" = "R2_SECRET_ACCESS_KEY"
}

foreach ($entry in $secretMap.GetEnumerator()) {
  $secretName = $entry.Key
  $environmentName = $entry.Value
  $secretValue = $values[$environmentName]
  if ([string]::IsNullOrWhiteSpace($secretValue)) {
    throw "Required value is missing from ${EnvFile}: $environmentName"
  }

  & $GcloudPath secrets describe $secretName --project=$ProjectId --quiet 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & $GcloudPath secrets create $secretName --project=$ProjectId --replication-policy=automatic --quiet | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create secret: $secretName" }
  }

  $temporarySecretFile = New-TemporaryFile
  try {
    Set-Content -LiteralPath $temporarySecretFile.FullName -Value $secretValue -NoNewline
    $temporarySecretPath = $temporarySecretFile.FullName
    & $GcloudPath secrets versions add $secretName --project=$ProjectId --data-file=$temporarySecretPath --quiet | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to add secret version: $secretName" }
  } finally {
    Remove-Item -LiteralPath $temporarySecretFile.FullName -Force -ErrorAction SilentlyContinue
  }

  Write-Output "Updated Secret Manager value: $secretName"
}
