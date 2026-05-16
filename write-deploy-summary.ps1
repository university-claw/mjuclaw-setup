[CmdletBinding()]
param(
  [string]$Title = "Production deployment summary",
  [string]$Mode = "production",
  [string]$ExpectedHead = "",
  [string]$DeployOutcome = "",
  [string]$SmokeOutcome = "",
  [string]$BackupOutcome = "",
  [string]$ReleaseFile = "release.env",
  [string]$ReleaseRoot = ".deploy\releases",
  [string]$BackupRoot = ".deploy\backups",
  [string]$SmokeRoot = ".deploy\smoke-tests"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
if (-not $Root) {
  $Root = (Get-Location).Path
}

function Resolve-RepoPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $Root $Path))
}

function Get-GitValue {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    return ""
  }

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & git -C $Root @Arguments 2>$null
    if ($LASTEXITCODE -eq 0) {
      $firstLine = $output | Select-Object -First 1
      if ($null -ne $firstLine) {
        return ($firstLine.ToString()).Trim()
      }
    }
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return ""
}

function Get-LatestRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [Parameter(Mandatory = $true)]
    [string]$ManifestName
  )

  $fullRoot = Resolve-RepoPath -Path $RootPath
  if (-not (Test-Path -LiteralPath $fullRoot -PathType Container)) {
    return $null
  }

  $dirs = Get-ChildItem -LiteralPath $fullRoot -Directory | Sort-Object Name -Descending
  foreach ($dir in $dirs) {
    $manifestPath = Join-Path $dir.FullName $ManifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
      continue
    }

    $json = $null
    try {
      $json = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    }
    catch {
      $json = $null
    }

    return [pscustomobject]@{
      Directory = $dir.FullName
      Manifest = $manifestPath
      Json = $json
    }
  }

  return $null
}

function Read-ReleaseValues {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $values[$parts[0].Trim()] = $parts[1].Trim()
  }

  return $values
}

function Get-ReleasePath {
  param(
    $DeployRecord,
    [string]$FallbackReleasePath
  )

  if ($DeployRecord -and $DeployRecord.Json) {
    $snapshot = [string]$DeployRecord.Json.releaseSnapshot
    if ($snapshot -and (Test-Path -LiteralPath $snapshot -PathType Leaf)) {
      return $snapshot
    }
  }

  return $FallbackReleasePath
}

function Add-Line {
  param(
    [AllowNull()]
    [object]$Lines,
    [AllowEmptyString()]
    [string]$Text = ""
  )

  $Lines.Add($Text)
}

function Add-RecordRow {
  param(
    [AllowNull()]
    [object]$Lines,
    [Parameter(Mandatory = $true)]
    [string]$Name,
    $Record,
    [string]$Status = ""
  )

  $path = "not found"
  if ($Record) {
    $path = $Record.Directory
    if (-not $Status -and $Record.Json -and $Record.Json.status) {
      $Status = [string]$Record.Json.status
    }
  }
  if (-not $Status) {
    $Status = "unknown"
  }

  Add-Line -Lines $Lines -Text "| $Name | ``$Status`` | ``$path`` |"
}

function Write-Summary {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  if ($env:GITHUB_STEP_SUMMARY) {
    Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value $Content -Encoding UTF8
  }

  Write-Host $Content
}

try {
  $releasePath = Resolve-RepoPath -Path $ReleaseFile
  $deployRecord = Get-LatestRecord -RootPath $ReleaseRoot -ManifestName "deploy.json"
  $backupRecord = Get-LatestRecord -RootPath $BackupRoot -ManifestName "backup.json"
  $smokeRecord = Get-LatestRecord -RootPath $SmokeRoot -ManifestName "smoke-test.json"
  $releaseSnapshotPath = Get-ReleasePath -DeployRecord $deployRecord -FallbackReleasePath $releasePath
  $releaseValues = Read-ReleaseValues -Path $releaseSnapshotPath

  $checkoutHead = Get-GitValue -Arguments @("rev-parse", "HEAD")
  $checkoutShortHead = Get-GitValue -Arguments @("rev-parse", "--short", "HEAD")
  $branch = Get-GitValue -Arguments @("branch", "--show-current")

  $deployStatus = ""
  if ($deployRecord -and $deployRecord.Json -and $deployRecord.Json.status) {
    $deployStatus = [string]$deployRecord.Json.status
  }
  $smokeStatus = ""
  if ($smokeRecord -and $smokeRecord.Json -and $smokeRecord.Json.status) {
    $smokeStatus = [string]$smokeRecord.Json.status
  }
  $backupStatus = ""
  if ($backupRecord -and $backupRecord.Json -and $backupRecord.Json.status) {
    $backupStatus = [string]$backupRecord.Json.status
  }

  $lines = [System.Collections.Generic.List[string]]::new()
  Add-Line -Lines $lines -Text "## $Title"
  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "| Field | Value |"
  Add-Line -Lines $lines -Text "|---|---|"
  Add-Line -Lines $lines -Text "| Mode | ``$Mode`` |"
  Add-Line -Lines $lines -Text "| Branch | ``$branch`` |"
  Add-Line -Lines $lines -Text "| Checkout SHA | ``$checkoutHead`` |"
  if ($checkoutShortHead) {
    Add-Line -Lines $lines -Text "| Checkout short SHA | ``$checkoutShortHead`` |"
  }
  if ($ExpectedHead) {
    Add-Line -Lines $lines -Text "| Expected source SHA | ``$ExpectedHead`` |"
  }
  if ($DeployOutcome) {
    Add-Line -Lines $lines -Text "| Deploy step outcome | ``$DeployOutcome`` |"
  }
  if ($BackupOutcome) {
    Add-Line -Lines $lines -Text "| Backup step outcome | ``$BackupOutcome`` |"
  }
  if ($SmokeOutcome) {
    Add-Line -Lines $lines -Text "| Smoke step outcome | ``$SmokeOutcome`` |"
  }

  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "### Release Images"
  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "Release source: ``$releaseSnapshotPath``"
  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "| Service | Image | Tag |"
  Add-Line -Lines $lines -Text "|---|---|---|"
  $services = @(
    @{ Name = "agent"; Image = "AGENT_IMAGE"; Tag = "AGENT_TAG" },
    @{ Name = "router"; Image = "ROUTER_IMAGE"; Tag = "ROUTER_TAG" },
    @{ Name = "worker"; Image = "WORKER_IMAGE"; Tag = "WORKER_TAG" },
    @{ Name = "classifier"; Image = "CLASSIFIER_IMAGE"; Tag = "CLASSIFIER_TAG" }
  )
  foreach ($service in $services) {
    $image = $releaseValues[$service["Image"]]
    $tag = $releaseValues[$service["Tag"]]
    if (-not $image) { $image = "unknown" }
    if (-not $tag) { $tag = "unknown" }
    Add-Line -Lines $lines -Text "| $($service["Name"]) | ``$image`` | ``$tag`` |"
  }

  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "### Records"
  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "| Record | Status | Path |"
  Add-Line -Lines $lines -Text "|---|---|---|"
  Add-RecordRow -Lines $lines -Name "Deployment" -Record $deployRecord -Status $deployStatus
  Add-RecordRow -Lines $lines -Name "Backup" -Record $backupRecord -Status $backupStatus
  Add-RecordRow -Lines $lines -Name "Smoke test" -Record $smokeRecord -Status $smokeStatus

  Add-Line -Lines $lines
  Add-Line -Lines $lines -Text "### Next Actions"
  Add-Line -Lines $lines
  if ($deployStatus -in @("succeeded", "rollback-succeeded") -and $smokeStatus -eq "succeeded") {
    Add-Line -Lines $lines -Text "- Deployment and smoke records indicate success."
    Add-Line -Lines $lines -Text "- Run one manual Discord/LLM conversation smoke check after production auto deploys."
  }
  elseif ($deployStatus -eq "failed") {
    Add-Line -Lines $lines -Text "- Inspect the deployment record and container logs."
    Add-Line -Lines $lines -Text "- If rollback did not complete automatically, consider ``.\deploy.ps1 -RollbackLatest``."
  }
  elseif ($smokeStatus -eq "failed") {
    Add-Line -Lines $lines -Text "- Inspect the smoke test record and related container logs."
    Add-Line -Lines $lines -Text "- Decide whether to rerun deploy, rerun smoke, or rollback based on the failed check."
  }
  else {
    Add-Line -Lines $lines -Text "- Confirm the deploy, backup, and smoke records above before taking follow-up action."
  }

  Write-Summary -Content ($lines -join [Environment]::NewLine)
}
catch {
  $message = "Deployment summary could not be generated: $($_.Exception.Message)"
  Write-Warning $message
  if ($env:GITHUB_STEP_SUMMARY) {
    Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value "## $Title`n`n$message" -Encoding UTF8
  }
  exit 0
}
