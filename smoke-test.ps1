[CmdletBinding()]
param(
  [string]$OutputRoot = ".deploy\smoke-tests",
  [switch]$SkipPublicDataWorker,
  [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $OutputRoot.Trim()) {
  throw "-OutputRoot must not be empty."
}

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

function Assert-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or is not available on PATH."
  }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Label"
  & $Action
}

function Invoke-DockerCapture {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & docker @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = ($output | ForEach-Object { $_.ToString() } | Out-String).Trim()
  }
}

function Assert-DockerDaemon {
  $result = Invoke-DockerCapture -Arguments @("version", "--format", "{{.Server.Version}}")
  if ($result.ExitCode -ne 0) {
    throw "Docker daemon is not available. Start Docker Desktop and try again. $($result.Output)"
  }
}

function Get-GitCommit {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    return $null
  }

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & git -C $Root rev-parse --short HEAD 2>$null
    if ($LASTEXITCODE -eq 0) {
      return ($output | Select-Object -First 1).ToString().Trim()
    }
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return $null
}

function Invoke-SmokeCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $startedAt = (Get-Date).ToUniversalTime()
  Write-Host "  $Name"

  $result = Invoke-DockerCapture -Arguments $Arguments
  $completedAt = (Get-Date).ToUniversalTime()
  $durationMs = [int][Math]::Round(($completedAt - $startedAt).TotalMilliseconds)

  $status = if ($result.ExitCode -eq 0) { "succeeded" } else { "failed" }
  $check = [ordered]@{
    name = $Name
    status = $status
    exitCode = $result.ExitCode
    output = $result.Output
    startedAt = $startedAt.ToString("o")
    completedAt = $completedAt.ToString("o")
    durationMs = $durationMs
  }
  $null = $script:Checks.Add($check)

  if ($result.ExitCode -ne 0) {
    throw "$Name failed. $($result.Output)"
  }
}

function Invoke-ContainerRunningCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Container
  )

  Invoke-SmokeCheck -Name $Name -Arguments @("inspect", "-f", "{{.State.Running}}", $Container)
  $lastCheck = $script:Checks[$script:Checks.Count - 1]
  if ($lastCheck["output"].Trim() -ne "true") {
    $lastCheck["status"] = "failed"
    throw "$Container is not running."
  }
}

function Invoke-LegacyWorkerAbsentCheck {
  $name = "legacy-worker-absent"
  $startedAt = (Get-Date).ToUniversalTime()
  Write-Host "  $name"

  $result = Invoke-DockerCapture -Arguments @("inspect", "mjuclaw-worker")
  $completedAt = (Get-Date).ToUniversalTime()
  $durationMs = [int][Math]::Round(($completedAt - $startedAt).TotalMilliseconds)
  $legacyPresent = ($result.ExitCode -eq 0)
  $status = if ($legacyPresent) { "failed" } else { "succeeded" }

  $check = [ordered]@{
    name = $name
    status = $status
    exitCode = $result.ExitCode
    output = $result.Output
    startedAt = $startedAt.ToString("o")
    completedAt = $completedAt.ToString("o")
    durationMs = $durationMs
  }
  $null = $script:Checks.Add($check)

  if ($legacyPresent) {
    throw "Legacy mjuclaw-worker container is present. Remove it before treating this deployment as healthy."
  }
}

function Write-SmokeRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Status,
    [AllowNull()]
    [string]$ErrorMessage
  )

  $completedAt = (Get-Date).ToUniversalTime()
  $durationMs = [int][Math]::Round(($completedAt - $script:StartedAt).TotalMilliseconds)
  $record = [ordered]@{
    schemaVersion = 1
    status = $Status
    startedAt = $script:StartedAt.ToString("o")
    completedAt = $completedAt.ToString("o")
    durationMs = $durationMs
    gitCommit = Get-GitCommit
    skipPublicDataWorker = [bool]$SkipPublicDataWorker
    checks = @($script:Checks)
  }

  if ($ErrorMessage) {
    $record["error"] = $ErrorMessage
  }

  $recordPath = Join-Path $script:RunRoot "smoke-test.json"
  $record | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path $recordPath
  Write-Host ""
  Write-Host "Smoke test record: $recordPath"
}

$OutputRootPath = Resolve-RepoPath -Path $OutputRoot

Invoke-Step "Checking smoke test inputs" {
  Write-Host "Output root: $OutputRootPath"
  Write-Host "Public data worker checks: $(if ($SkipPublicDataWorker) { "skipped" } else { "enabled" })"
}

if ($CheckOnly) {
  Write-Host ""
  Write-Host "Planned smoke checks:"
  Write-Host "  agent-health"
  Write-Host "  router-health"
  Write-Host "  classifier-health"
  if (-not $SkipPublicDataWorker) {
    Write-Host "  legacy-worker-absent"
    Write-Host "  public-data-worker-running"
    Write-Host "  public-data-worker-doctor"
    Write-Host "  public-data-worker-schedule-dry-run"
  }
  Write-Host ""
  Write-Host "Check-only completed. No smoke test artifacts were created."
  exit 0
}

$script:StartedAt = (Get-Date).ToUniversalTime()
$script:Checks = [System.Collections.ArrayList]::new()
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$script:RunRoot = Join-Path $OutputRootPath $timestamp
$status = "running"
$errorMessage = $null

New-Item -ItemType Directory -Force -Path $script:RunRoot | Out-Null

try {
  Invoke-Step "Checking Docker state" {
    Assert-Command -Name "docker"
    Assert-DockerDaemon
  }

  Invoke-Step "Checking service health" {
    Invoke-SmokeCheck -Name "agent-health" -Arguments @("exec", "mjuclaw-agent", "curl", "-fsS", "--max-time", "5", "http://localhost:3001/health")
    Invoke-SmokeCheck -Name "router-health" -Arguments @("exec", "mjuclaw-router", "curl", "-fsS", "--max-time", "5", "http://localhost:3100/healthz")
    Invoke-SmokeCheck -Name "classifier-health" -Arguments @("exec", "mjuclaw-classifier", "curl", "-fsS", "--max-time", "5", "http://localhost:3200/healthz")
  }

  if (-not $SkipPublicDataWorker) {
    Invoke-Step "Checking public data worker" {
      Invoke-LegacyWorkerAbsentCheck
      Invoke-ContainerRunningCheck -Name "public-data-worker-running" -Container "mjuclaw-public-data-worker"
      Invoke-SmokeCheck -Name "public-data-worker-doctor" -Arguments @("exec", "mjuclaw-public-data-worker", "node", "dist/main.js", "doctor")
      Invoke-SmokeCheck -Name "public-data-worker-schedule-dry-run" -Arguments @("exec", "mjuclaw-public-data-worker", "node", "dist/main.js", "schedule", "tick", "--dry-run")
    }
  }

  $status = "succeeded"
}
catch {
  $status = "failed"
  $errorMessage = $_.Exception.Message
  Write-Host ""
  Write-Host "Smoke test failed: $errorMessage" -ForegroundColor Red
}
finally {
  Write-SmokeRecord -Status $status -ErrorMessage $errorMessage
}

if ($status -ne "succeeded") {
  exit 1
}

Write-Host ""
Write-Host "Smoke test completed."
