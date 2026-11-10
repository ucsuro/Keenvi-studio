[CmdletBinding()]
param(
  [string]$ProjectId = "keenvi-studio",
  [string]$ServiceName = "keenvi-studio-api",
  [string]$ServiceHost = "keenvi-studio-api-1046121485048.asia-east1.run.app",
  [string[]]$NotificationEmails = @("ucsuro@gmail.com", "ucsuro@naver.com"),
  [string]$BillingAccountId = "0165DF-1F9F0A-F77499",
  [string]$BudgetDisplayName = "₩10,000 월 예산 알림",
  [string]$GcloudPath = "C:\Users\ucsur\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $GcloudPath)) {
  throw "Google Cloud CLI not found: $GcloudPath"
}

& $GcloudPath services enable monitoring.googleapis.com billingbudgets.googleapis.com --project=$ProjectId --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to enable monitoring APIs." }

$token = & $GcloudPath auth print-access-token
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
  throw "Could not obtain a Google Cloud access token."
}

$headers = @{
  Authorization = "Bearer $token"
  "x-goog-user-project" = $ProjectId
}
$baseUri = "https://monitoring.googleapis.com/v3/projects/$ProjectId"

function Invoke-GoogleApi {
  param(
    [Parameter(Mandatory)] [string]$Method,
    [Parameter(Mandatory)] [string]$Uri,
    [object]$Body
  )

  $arguments = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
  }
  if ($null -ne $Body) {
    $arguments.ContentType = "application/json"
    $arguments.Body = $Body | ConvertTo-Json -Depth 20
  }
  Invoke-RestMethod @arguments
}

function Get-OrCreateResource {
  param(
    [Parameter(Mandatory)] [string]$Collection,
    [Parameter(Mandatory)] [string]$ResponseProperty,
    [Parameter(Mandatory)] [string]$DisplayName,
    [Parameter(Mandatory)] [hashtable]$Body
  )

  $existingResponse = Invoke-GoogleApi -Method Get -Uri "$baseUri/$Collection"
  $existing = @($existingResponse.$ResponseProperty) |
    Where-Object { $_.displayName -eq $DisplayName } |
    Select-Object -First 1
  if ($existing) {
    Write-Host "Already configured: $DisplayName"
    return $existing
  }

  $created = Invoke-GoogleApi -Method Post -Uri "$baseUri/$Collection" -Body $Body
  Write-Host "Created: $DisplayName"
  return $created
}

$emailChannels = foreach ($notificationEmail in $NotificationEmails) {
  $channelDisplayName = if ($notificationEmail -eq "ucsuro@gmail.com") {
    "Keenvi Studio operations email"
  } else {
    "Keenvi Studio operations email ($notificationEmail)"
  }
  Get-OrCreateResource `
    -Collection "notificationChannels" `
    -ResponseProperty "notificationChannels" `
    -DisplayName $channelDisplayName `
    -Body @{
      type = "email"
      displayName = $channelDisplayName
      labels = @{ email_address = $notificationEmail }
      enabled = $true
    }
}
$notificationChannelNames = @($emailChannels.name)

$uptimeDisplayName = "Keenvi Studio API health"
$uptime = Get-OrCreateResource `
  -Collection "uptimeCheckConfigs" `
  -ResponseProperty "uptimeCheckConfigs" `
  -DisplayName $uptimeDisplayName `
  -Body @{
    displayName = $uptimeDisplayName
    monitoredResource = @{
      type = "uptime_url"
      labels = @{
        project_id = $ProjectId
        host = $ServiceHost
      }
    }
    httpCheck = @{
      requestMethod = "GET"
      useSsl = $true
      path = "/api/health"
      port = 443
      validateSsl = $true
      acceptedResponseStatusCodes = @(@{ statusClass = "STATUS_CLASS_2XX" })
    }
    period = "60s"
    timeout = "10s"
    selectedRegions = @("ASIA_PACIFIC", "EUROPE", "USA")
    checkerType = "STATIC_IP_CHECKERS"
  }

$uptimeCheckId = ($uptime.name -split "/")[-1]

$policies = @(
  @{
    displayName = "Keenvi Studio API unavailable"
    documentation = @{
      content = "The public /api/health endpoint failed for at least two minutes. Check the latest Cloud Run revision and logs."
      mimeType = "text/markdown"
    }
    combiner = "OR"
    enabled = $true
    notificationChannels = $notificationChannelNames
    alertStrategy = @{ autoClose = "1800s" }
    conditions = @(@{
      displayName = "Health check pass rate below 100%"
      conditionThreshold = @{
        filter = "resource.type = `"uptime_url`" AND metric.type = `"monitoring.googleapis.com/uptime_check/check_passed`" AND metric.labels.check_id = `"$uptimeCheckId`""
        comparison = "COMPARISON_LT"
        thresholdValue = 1
        duration = "120s"
        aggregations = @(@{
          alignmentPeriod = "60s"
          perSeriesAligner = "ALIGN_FRACTION_TRUE"
          crossSeriesReducer = "REDUCE_MEAN"
        })
        trigger = @{ count = 1 }
      }
    })
  },
  @{
    displayName = "Keenvi Studio API 5xx errors"
    documentation = @{
      content = "Cloud Run returned at least one 5xx response in a five-minute window. Inspect Cloud Run request and application logs."
      mimeType = "text/markdown"
    }
    combiner = "OR"
    enabled = $true
    notificationChannels = $notificationChannelNames
    alertStrategy = @{ autoClose = "1800s" }
    conditions = @(@{
      displayName = "Any 5xx response"
      conditionThreshold = @{
        filter = "resource.type = `"cloud_run_revision`" AND resource.labels.service_name = `"$ServiceName`" AND metric.type = `"run.googleapis.com/request_count`" AND metric.labels.response_code_class = `"5xx`""
        comparison = "COMPARISON_GT"
        thresholdValue = 0
        duration = "0s"
        aggregations = @(@{
          alignmentPeriod = "300s"
          perSeriesAligner = "ALIGN_SUM"
          crossSeriesReducer = "REDUCE_SUM"
          groupByFields = @("resource.labels.service_name")
        })
        trigger = @{ count = 1 }
      }
    })
  },
  @{
    displayName = "Keenvi Studio API high latency"
    documentation = @{
      content = "Cloud Run p95 request latency exceeded five seconds for five minutes. Inspect traffic, instance startup, and downstream services."
      mimeType = "text/markdown"
    }
    combiner = "OR"
    enabled = $true
    notificationChannels = $notificationChannelNames
    alertStrategy = @{ autoClose = "1800s" }
    conditions = @(@{
      displayName = "p95 latency above five seconds"
      conditionThreshold = @{
        filter = "resource.type = `"cloud_run_revision`" AND resource.labels.service_name = `"$ServiceName`" AND metric.type = `"run.googleapis.com/request_latencies`""
        comparison = "COMPARISON_GT"
        thresholdValue = 5000
        duration = "300s"
        aggregations = @(@{
          alignmentPeriod = "60s"
          perSeriesAligner = "ALIGN_PERCENTILE_95"
          crossSeriesReducer = "REDUCE_MAX"
          groupByFields = @("resource.labels.service_name")
        })
        trigger = @{ count = 1 }
      }
    })
  }
)

foreach ($policy in $policies) {
  $configuredPolicy = Get-OrCreateResource `
    -Collection "alertPolicies" `
    -ResponseProperty "alertPolicies" `
    -DisplayName $policy.displayName `
    -Body $policy

  $missingChannels = @($notificationChannelNames) |
    Where-Object { @($configuredPolicy.notificationChannels) -notcontains $_ }
  if ($missingChannels.Count -gt 0) {
    $updatedChannels = @($configuredPolicy.notificationChannels) + @($missingChannels) |
      Select-Object -Unique
    Invoke-GoogleApi `
      -Method Patch `
      -Uri "https://monitoring.googleapis.com/v3/$($configuredPolicy.name)?updateMask=notificationChannels" `
      -Body @{
        name = $configuredPolicy.name
        notificationChannels = @($updatedChannels)
      } | Out-Null
    Write-Host "Updated notification recipients: $($policy.displayName)"
  }
}

$budgetBaseUri = "https://billingbudgets.googleapis.com/v1/billingAccounts/$BillingAccountId"
$budgetResponse = Invoke-GoogleApi -Method Get -Uri "$budgetBaseUri/budgets"
$budget = @($budgetResponse.budgets) |
  Where-Object { $_.displayName -eq $BudgetDisplayName } |
  Select-Object -First 1

if ($budget) {
  $existingRule = $budget.notificationsRule
  $channels = @($existingRule.monitoringNotificationChannels) + @($notificationChannelNames) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Unique

  $missingBudgetChannels = @($notificationChannelNames) |
    Where-Object { @($existingRule.monitoringNotificationChannels) -notcontains $_ }
  if ($missingBudgetChannels.Count -eq 0) {
    Write-Host "Already linked budget alerts: $BudgetDisplayName"
  } else {
    $notificationsRule = @{
      monitoringNotificationChannels = @($channels)
      disableDefaultIamRecipients = $false
    }
    if ($existingRule.pubsubTopic) { $notificationsRule.pubsubTopic = $existingRule.pubsubTopic }
    if ($existingRule.schemaVersion) { $notificationsRule.schemaVersion = $existingRule.schemaVersion }
    if ($existingRule.enableProjectLevelRecipients) {
      $notificationsRule.enableProjectLevelRecipients = $true
    }

    Invoke-GoogleApi `
      -Method Patch `
      -Uri "https://billingbudgets.googleapis.com/v1/$($budget.name)?updateMask=notificationsRule" `
      -Body @{
        name = $budget.name
        notificationsRule = $notificationsRule
      } | Out-Null
    Write-Host "Linked budget alerts: $BudgetDisplayName"
  }
} else {
  Write-Warning "Budget not found; no budget alert recipient was changed: $BudgetDisplayName"
}

Write-Output "Monitoring setup complete. Verify the notification email if Google Cloud requests confirmation."
