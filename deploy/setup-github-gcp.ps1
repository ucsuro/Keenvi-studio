[CmdletBinding()]
param(
  [string]$ProjectId = "keenvi-studio",
  [string]$ProjectNumber = "1046121485048",
  [string]$Repository = "ucsuro/Keenvi-studio",
  [string]$RepositoryId = "1232138087",
  [string]$PoolId = "github-actions",
  [string]$ProviderId = "keenvi-studio",
  [string]$DeployerAccountId = "keenvi-github-deployer",
  [string]$RuntimeServiceAccount = "keenvi-studio-api@keenvi-studio.iam.gserviceaccount.com",
  [string]$GcloudPath = "C:\Users\ucsur\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $GcloudPath)) {
  throw "Google Cloud CLI not found: $GcloudPath"
}

$deployerServiceAccount = "$DeployerAccountId@$ProjectId.iam.gserviceaccount.com"
$computeServiceAccount = "$ProjectNumber-compute@developer.gserviceaccount.com"

& $GcloudPath services enable `
  iamcredentials.googleapis.com `
  sts.googleapis.com `
  --project=$ProjectId `
  --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to enable IAM credential APIs." }

& $GcloudPath iam service-accounts describe $deployerServiceAccount --project=$ProjectId --quiet 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $GcloudPath iam service-accounts create $DeployerAccountId `
    --project=$ProjectId `
    --display-name="Keenvi GitHub deployer" `
    --quiet | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to create GitHub deployer service account." }
  # IAM can briefly reject bindings while a newly-created account propagates.
  Start-Sleep -Seconds 10
}

foreach ($role in @("roles/run.sourceDeveloper", "roles/serviceusage.serviceUsageConsumer")) {
  & $GcloudPath projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$deployerServiceAccount" `
    --role=$role `
    --condition=None `
    --quiet | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to grant $role." }
}

& $GcloudPath iam service-accounts add-iam-policy-binding $RuntimeServiceAccount `
  --project=$ProjectId `
  --member="serviceAccount:$deployerServiceAccount" `
  --role="roles/iam.serviceAccountUser" `
  --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to grant access to the runtime service account." }

& $GcloudPath projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$computeServiceAccount" `
  --role="roles/run.builder" `
  --condition=None `
  --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to grant Cloud Run Builder to the build identity." }

& $GcloudPath iam workload-identity-pools describe $PoolId `
  --project=$ProjectId `
  --location=global `
  --quiet 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $GcloudPath iam workload-identity-pools create $PoolId `
    --project=$ProjectId `
    --location=global `
    --display-name="GitHub Actions" `
    --quiet | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to create Workload Identity pool." }
}

& $GcloudPath iam workload-identity-pools providers describe $ProviderId `
  --project=$ProjectId `
  --location=global `
  --workload-identity-pool=$PoolId `
  --quiet 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $GcloudPath iam workload-identity-pools providers create-oidc $ProviderId `
    --project=$ProjectId `
    --location=global `
    --workload-identity-pool=$PoolId `
    --display-name="Keenvi Studio GitHub" `
    --issuer-uri="https://token.actions.githubusercontent.com" `
    --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" `
    --attribute-condition="assertion.repository_id == '$RepositoryId' && assertion.ref == 'refs/heads/main'" `
    --quiet | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to create Workload Identity provider." }
}

$poolName = & $GcloudPath iam workload-identity-pools describe $PoolId `
  --project=$ProjectId `
  --location=global `
  --format="value(name)"
$principal = "principalSet://iam.googleapis.com/$poolName/attribute.repository_id/$RepositoryId"

& $GcloudPath iam service-accounts add-iam-policy-binding $deployerServiceAccount `
  --project=$ProjectId `
  --member=$principal `
  --role="roles/iam.workloadIdentityUser" `
  --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to bind the GitHub identity to the deployer account." }

$providerName = & $GcloudPath iam workload-identity-pools providers describe $ProviderId `
  --project=$ProjectId `
  --location=global `
  --workload-identity-pool=$PoolId `
  --format="value(name)"

Write-Output "GCP_WORKLOAD_IDENTITY_PROVIDER=$providerName"
Write-Output "GCP_DEPLOY_SERVICE_ACCOUNT=$deployerServiceAccount"
Write-Output "Restricted to GitHub repository $Repository (ID $RepositoryId), main branch only."
