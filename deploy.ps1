[CmdletBinding()]
param(
  [string]$EnvFile = ".env.production",
  [string]$ReleaseFile = "release.env",
  [switch]$Ngrok,
  [switch]$PullOnly,
  [switch]$NoPull,
  [switch]$CheckOnly,
  [switch]$WaitHealthy,
  [switch]$SkipHealthCheck,
  [int]$HealthTimeoutSeconds = 120,
  [int]$HealthIntervalSeconds = 5,
  [switch]$RollbackOnFailure,
  [string]$Rollback = "",
  [switch]$RollbackLatest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($PullOnly -and $NoPull) {
  throw "-PullOnly and -NoPull cannot be used together."
}

if ($CheckOnly -and ($PullOnly -or $NoPull -or $RollbackOnFailure -or $Rollback -or $RollbackLatest -or $WaitHealthy -or $SkipHealthCheck)) {
  throw "-CheckOnly cannot be used with pull, deploy, rollback, or health options."
}

if ($WaitHealthy -and $SkipHealthCheck) {
  throw "-WaitHealthy and -SkipHealthCheck cannot be used together."
}

if ($RollbackOnFailure -and $SkipHealthCheck) {
  throw "-RollbackOnFailure requires health checks. Remove -SkipHealthCheck."
}

if ($PullOnly -and $RollbackOnFailure) {
  throw "-RollbackOnFailure cannot be used with -PullOnly."
}

if ($PullOnly -and ($Rollback -or $RollbackLatest)) {
  throw "Rollback mode cannot be used with -PullOnly."
}

if ($Rollback -and $RollbackLatest) {
  throw "Use either -Rollback <snapshot> or -RollbackLatest, not both."
}

if ($HealthTimeoutSeconds -lt 1) {
  throw "-HealthTimeoutSeconds must be greater than 0."
}

if ($HealthIntervalSeconds -lt 1) {
  throw "-HealthIntervalSeconds must be greater than 0."
}

$Root = $PSScriptRoot
if (-not $Root) {
  $Root = (Get-Location).Path
}

$DeployRoot = Join-Path $Root ".deploy"
$ReleaseRoot = Join-Path $DeployRoot "releases"

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

function Assert-File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Label not found: $Path"
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

function Invoke-Docker {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
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

function Assert-ReleaseFileIsPinned {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $content = Get-Content -LiteralPath $Path -Raw
  if ($content -match "sha-replace-me|replace-me") {
    throw "$Path still contains placeholder release tags. Pin release.env before deploying."
  }
}

function Read-KeyValueFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    $value = $value.Trim('"')
    $value = $value.Trim("'")
    $values[$key] = $value
  }

  return $values
}

function Get-ReleaseValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Values,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$Default
  )

  if ($Values.ContainsKey($Key) -and $Values[$Key]) {
    return $Values[$Key]
  }

  return $Default
}

function Show-ReleasePlan {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ReleasePath
  )

  $values = Read-KeyValueFile -Path $ReleasePath
  $services = @(
    @{
      Name = "agent"
      Image = (Get-ReleaseValue -Values $values -Key "AGENT_IMAGE" -Default "ghcr.io/university-claw/mjuclaw-agent")
      Tag = (Get-ReleaseValue -Values $values -Key "AGENT_TAG" -Default "main")
    },
    @{
      Name = "router"
      Image = (Get-ReleaseValue -Values $values -Key "ROUTER_IMAGE" -Default "ghcr.io/university-claw/mjuclaw-router")
      Tag = (Get-ReleaseValue -Values $values -Key "ROUTER_TAG" -Default "main")
    },
    @{
      Name = "worker"
      Image = (Get-ReleaseValue -Values $values -Key "WORKER_IMAGE" -Default "ghcr.io/university-claw/mju-public-data-worker")
      Tag = (Get-ReleaseValue -Values $values -Key "WORKER_TAG" -Default "main")
    },
    @{
      Name = "classifier"
      Image = (Get-ReleaseValue -Values $values -Key "CLASSIFIER_IMAGE" -Default "ghcr.io/university-claw/intent-classifier")
      Tag = (Get-ReleaseValue -Values $values -Key "CLASSIFIER_TAG" -Default "main")
    }
  )

  Write-Host "Planned images:"
  foreach ($service in $services) {
    Write-Host ("  {0,-10} {1}:{2}" -f $service.Name, $service.Image, $service.Tag)
  }
}

function New-ComposeArgs {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ReleasePath
  )

  $args = @(
    "compose",
    "--env-file", $script:EnvFilePath,
    "--env-file", $ReleasePath,
    "-f", $script:ProdComposePath
  )

  if ($script:NgrokEnabled) {
    $args += @("-f", $script:NgrokComposePath, "--profile", "ngrok")
  }

  return $args
}

function New-DeploymentRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ReleasePath,
    [Parameter(Mandatory = $true)]
    [string]$Mode
  )

  New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $path = Join-Path $ReleaseRoot $timestamp
  $suffix = 1

  while (Test-Path -LiteralPath $path) {
    $path = Join-Path $ReleaseRoot "$timestamp-$suffix"
    $suffix += 1
  }

  New-Item -ItemType Directory -Force -Path $path | Out-Null
  Copy-Item -LiteralPath $ReleasePath -Destination (Join-Path $path "release.env") -Force

  $record = [ordered]@{
    mode = $Mode
    status = "pending"
    startedAt = (Get-Date).ToString("o")
    completedAt = $null
    envFile = $EnvFilePath
    releaseFile = $ReleasePath
    releaseSnapshot = (Join-Path $path "release.env")
    ngrok = [bool]$NgrokEnabled
    noPull = [bool]$NoPull
    pullOnly = [bool]$PullOnly
    healthCheck = [bool]$script:ShouldRunHealth
    healthTimeoutSeconds = $HealthTimeoutSeconds
    healthIntervalSeconds = $HealthIntervalSeconds
    rollbackOnFailure = [bool]$RollbackOnFailure
    rollbackTo = $null
    error = $null
  }

  Write-DeploymentRecord -RecordPath $path -Record $record

  return [pscustomobject]@{
    Path = $path
    Metadata = $record
  }
}

function Write-DeploymentRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RecordPath,
    [Parameter(Mandatory = $true)]
    $Record
  )

  $Record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $RecordPath "deploy.json") -Encoding UTF8
}

function Complete-DeploymentRecord {
  param(
    [Parameter(Mandatory = $true)]
    $Deployment,
    [Parameter(Mandatory = $true)]
    [string]$Status,
    [string]$ErrorMessage = "",
    [string]$RollbackTo = ""
  )

  $Deployment.Metadata.status = $Status
  $Deployment.Metadata.completedAt = (Get-Date).ToString("o")
  if ($ErrorMessage) {
    $Deployment.Metadata.error = $ErrorMessage
  }
  if ($RollbackTo) {
    $Deployment.Metadata.rollbackTo = $RollbackTo
  }
  Write-DeploymentRecord -RecordPath $Deployment.Path -Record $Deployment.Metadata
}

function Get-DeploymentRecord {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $metadataPath = Join-Path $Path "deploy.json"
  if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    return $null
  }

  return Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
}

function Find-LatestSuccessfulSnapshot {
  param(
    [string]$ExcludePath = ""
  )

  if (-not (Test-Path -LiteralPath $ReleaseRoot -PathType Container)) {
    return $null
  }

  $excluded = ""
  if ($ExcludePath) {
    $excluded = [System.IO.Path]::GetFullPath($ExcludePath)
  }

  $dirs = Get-ChildItem -LiteralPath $ReleaseRoot -Directory | Sort-Object Name -Descending
  foreach ($dir in $dirs) {
    $fullPath = [System.IO.Path]::GetFullPath($dir.FullName)
    if ($excluded -and $fullPath -eq $excluded) {
      continue
    }

    $record = Get-DeploymentRecord -Path $dir.FullName
    if (-not $record) {
      continue
    }

    if ($record.status -notin @("succeeded", "rollback-succeeded")) {
      continue
    }

    $releaseSnapshot = Join-Path $dir.FullName "release.env"
    if (Test-Path -LiteralPath $releaseSnapshot -PathType Leaf) {
      return $dir.FullName
    }
  }

  return $null
}

function Resolve-RollbackReleaseFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Snapshot
  )

  $path = Resolve-RepoPath $Snapshot
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    return $path
  }

  if (Test-Path -LiteralPath $path -PathType Container) {
    $releasePath = Join-Path $path "release.env"
    Assert-File $releasePath "rollback release.env"
    return $releasePath
  }

  throw "Rollback snapshot not found: $Snapshot"
}

function Test-HealthOnce {
  $checks = @(
    @{ Name = "agent"; Args = @("exec", "mjuclaw-agent", "curl", "-fsS", "--max-time", "5", "http://localhost:3001/health") },
    @{ Name = "router"; Args = @("exec", "mjuclaw-router", "curl", "-fsS", "--max-time", "5", "http://localhost:3100/healthz") },
    @{ Name = "classifier"; Args = @("exec", "mjuclaw-classifier", "curl", "-fsS", "--max-time", "5", "http://localhost:3200/healthz") }
  )

  $results = @()
  foreach ($check in $checks) {
    $result = Invoke-DockerCapture -Arguments $check.Args
    $results += [pscustomobject]@{
      Name = $check.Name
      Healthy = ($result.ExitCode -eq 0)
      Output = $result.Output
    }
  }

  return $results
}

function Wait-Healthy {
  $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
  $lastResults = @()

  do {
    $lastResults = Test-HealthOnce
    $failed = @($lastResults | Where-Object { -not $_.Healthy })

    if ($failed.Count -eq 0) {
      foreach ($result in $lastResults) {
        Write-Host "  OK $($result.Name)"
      }
      return
    }

    $failedNames = ($failed | ForEach-Object { $_.Name }) -join ", "
    Write-Host "  Waiting for healthy services: $failedNames"
    Start-Sleep -Seconds $HealthIntervalSeconds
  } while ((Get-Date) -lt $deadline)

  $summary = ($lastResults | ForEach-Object {
    $status = if ($_.Healthy) { "OK" } else { "FAIL" }
    "$status $($_.Name): $($_.Output)"
  }) -join "`n"

  throw "Health check failed after ${HealthTimeoutSeconds}s.`n$summary"
}

function Invoke-ComposeDeployment {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ReleasePath,
    [Parameter(Mandatory = $true)]
    [bool]$SkipPull,
    [Parameter(Mandatory = $true)]
    [bool]$OnlyPull,
    [Parameter(Mandatory = $true)]
    [bool]$RunHealth
  )

  $composeArgs = New-ComposeArgs -ReleasePath $ReleasePath

  Invoke-Step "Validating compose configuration" {
    Invoke-Docker -Arguments ($composeArgs + @("config", "--quiet"))
  }

  if (-not $SkipPull) {
    Invoke-Step "Pulling images" {
      Invoke-Docker -Arguments ($composeArgs + @("pull"))
    }
  }

  if ($OnlyPull) {
    Write-Host ""
    Write-Host "Pull complete. Skipping service start because -PullOnly was set."
    return
  }

  Invoke-Step "Starting services" {
    Invoke-Docker -Arguments ($composeArgs + @("up", "-d"))
  }

  Invoke-Step "Current service status" {
    Invoke-Docker -Arguments ($composeArgs + @("ps"))
  }

  if ($RunHealth) {
    Invoke-Step "Waiting for healthy services" {
      Wait-Healthy
    }

    Invoke-Step "Recent worker logs" {
      Invoke-Docker -Arguments @("logs", "mjuclaw-worker", "--tail", "20")
    }
  }
  else {
    Write-Host ""
    Write-Host "Health checks were skipped."
  }
}

$EnvFilePath = Resolve-RepoPath $EnvFile
$ReleaseFilePath = Resolve-RepoPath $ReleaseFile
$ProdComposePath = Resolve-RepoPath "docker-compose.prod.yml"
$NgrokComposePath = Resolve-RepoPath "docker-compose.ngrok.yml"
$NgrokEnabled = [bool]$Ngrok
$RollbackMode = [bool]($Rollback -or $RollbackLatest)
$ShouldRunHealth = -not [bool]$SkipHealthCheck -and -not [bool]$PullOnly
$Deployment = $null
$PreviousSuccessfulSnapshot = $null

Push-Location $Root
try {
  Invoke-Step "Checking prerequisites" {
    Assert-Command "docker"
    Assert-File $EnvFilePath "env file"
    Assert-File $ProdComposePath "docker-compose.prod.yml"
    if ($NgrokEnabled) {
      Assert-File $NgrokComposePath "docker-compose.ngrok.yml"
    }

    Invoke-Docker -Arguments @("info", "--format", "{{.ServerVersion}}")
    Invoke-Docker -Arguments @("compose", "version")
  }

  if ($RollbackMode) {
    if ($RollbackLatest) {
      $snapshot = Find-LatestSuccessfulSnapshot
      if (-not $snapshot) {
        throw "No successful deployment snapshot found under $ReleaseRoot."
      }
      $ReleaseFilePath = Join-Path $snapshot "release.env"
    }
    else {
      $ReleaseFilePath = Resolve-RollbackReleaseFile -Snapshot $Rollback
    }

    Assert-ReleaseFileIsPinned $ReleaseFilePath
    $Deployment = New-DeploymentRecord -ReleasePath $ReleaseFilePath -Mode "rollback"
    Write-Host "Rollback release file: $ReleaseFilePath"
  }
  else {
    Assert-File $ReleaseFilePath "release file"
    Assert-ReleaseFileIsPinned $ReleaseFilePath
    if ($CheckOnly) {
      Invoke-Step "Validating compose configuration" {
        Invoke-Docker -Arguments ((New-ComposeArgs -ReleasePath $ReleaseFilePath) + @("config", "--quiet"))
      }

      Invoke-Step "Planned release images" {
        Show-ReleasePlan -ReleasePath $ReleaseFilePath
      }

      Write-Host ""
      Write-Host "Check-only preflight completed. No images were pulled and no services were changed."
      return
    }

    $PreviousSuccessfulSnapshot = Find-LatestSuccessfulSnapshot
    $Deployment = New-DeploymentRecord -ReleasePath $ReleaseFilePath -Mode "deploy"
  }

  Invoke-ComposeDeployment `
    -ReleasePath $ReleaseFilePath `
    -SkipPull ([bool]$NoPull) `
    -OnlyPull ([bool]$PullOnly) `
    -RunHealth $ShouldRunHealth

  if ($PullOnly) {
    Complete-DeploymentRecord -Deployment $Deployment -Status "pulled"
  }
  elseif ($RollbackMode) {
    Complete-DeploymentRecord -Deployment $Deployment -Status "rollback-succeeded"
  }
  else {
    Complete-DeploymentRecord -Deployment $Deployment -Status "succeeded"
  }

  Write-Host ""
  Write-Host "Deployment command completed."
  Write-Host "Deployment record: $($Deployment.Path)"
}
catch {
  $errorMessage = $_.Exception.Message
  Write-Host ""
  Write-Host "Deployment failed: $errorMessage" -ForegroundColor Red

  if ($Deployment) {
    Complete-DeploymentRecord -Deployment $Deployment -Status "failed" -ErrorMessage $errorMessage
  }

  if ($RollbackOnFailure -and -not $RollbackMode) {
    if (-not $PreviousSuccessfulSnapshot) {
      Write-Host "No previous successful deployment snapshot is available for rollback." -ForegroundColor Yellow
      throw
    }

    $rollbackRelease = Join-Path $PreviousSuccessfulSnapshot "release.env"
    Write-Host ""
    Write-Host "Rolling back to: $PreviousSuccessfulSnapshot" -ForegroundColor Yellow

    try {
      Invoke-ComposeDeployment `
        -ReleasePath $rollbackRelease `
        -SkipPull ([bool]$NoPull) `
        -OnlyPull $false `
        -RunHealth $true

      Complete-DeploymentRecord `
        -Deployment $Deployment `
        -Status "failed-rolled-back" `
        -ErrorMessage $errorMessage `
        -RollbackTo $PreviousSuccessfulSnapshot

      Write-Host ""
      Write-Host "Rollback completed."
    }
    catch {
      Complete-DeploymentRecord `
        -Deployment $Deployment `
        -Status "rollback-failed" `
        -ErrorMessage "$errorMessage`nRollback error: $($_.Exception.Message)" `
        -RollbackTo $PreviousSuccessfulSnapshot

      Write-Host "Rollback failed: $($_.Exception.Message)" -ForegroundColor Red
      throw
    }
  }

  throw
}
finally {
  Pop-Location
}
