[CmdletBinding()]
param(
  [string]$EnvFile = ".env.production",
  [string]$ReleaseFile = "release.env",
  [string]$OutputRoot = ".deploy\backups",
  [string]$ComposeProjectName = "mjuclaw-setup",
  [switch]$SkipDbDump,
  [switch]$IncludePaddleModels,
  [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $EnvFile.Trim()) {
  throw "-EnvFile must not be empty."
}

if (-not $ReleaseFile.Trim()) {
  throw "-ReleaseFile must not be empty."
}

if (-not $OutputRoot.Trim()) {
  throw "-OutputRoot must not be empty."
}

if (-not $ComposeProjectName.Trim()) {
  throw "-ComposeProjectName must not be empty."
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

function Assert-DockerDaemon {
  $result = Invoke-DockerCapture -Arguments @("version", "--format", "{{.Server.Version}}")
  if ($result.ExitCode -ne 0) {
    throw "Docker daemon is not available. Start Docker Desktop and try again. $($result.Output)"
  }
}

function Assert-DockerVolume {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $result = Invoke-DockerCapture -Arguments @("volume", "inspect", $Name)
  if ($result.ExitCode -ne 0) {
    throw "Docker volume not found: $Name"
  }
}

function Assert-ContainerRunning {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $result = Invoke-DockerCapture -Arguments @("inspect", "-f", "{{.State.Running}}", $Name)
  if ($result.ExitCode -ne 0 -or $result.Output.Trim() -ne "true") {
    throw "Docker container is not running: $Name"
  }
}

function Add-Artifact {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [System.Collections.ArrayList]$Artifacts,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Kind
  )

  $item = Get-Item -LiteralPath $Path
  $hash = Get-FileHash -LiteralPath $Path -Algorithm SHA256
  $null = $Artifacts.Add([ordered]@{
    name = $item.Name
    kind = $Kind
    bytes = $item.Length
    sha256 = $hash.Hash.ToLowerInvariant()
  })
}

function Copy-BackupFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [Parameter(Mandatory = $true)]
    [string]$Kind,
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [System.Collections.ArrayList]$Artifacts
  )

  Copy-Item -LiteralPath $Source -Destination $Destination -Force
  Add-Artifact -Artifacts $Artifacts -Path $Destination -Kind $Kind
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

$EnvFilePath = Resolve-RepoPath -Path $EnvFile
$ReleaseFilePath = Resolve-RepoPath -Path $ReleaseFile
$OutputRootPath = Resolve-RepoPath -Path $OutputRoot
$ProdComposePath = Join-Path $Root "docker-compose.prod.yml"
$NgrokComposePath = Join-Path $Root "docker-compose.ngrok.yml"

$volumeNames = @("agent-data", "router-data", "user-data", "public-data-assets")
if ($IncludePaddleModels) {
  $volumeNames += "public-data-paddle-models"
}

$fullVolumeNames = $volumeNames | ForEach-Object { "${ComposeProjectName}_$_" }

Invoke-Step "Checking backup inputs" {
  Assert-Command -Name "docker"
  Assert-File -Path $EnvFilePath -Label "Env file"
  Assert-File -Path $ReleaseFilePath -Label "Release file"
  Assert-File -Path $ProdComposePath -Label "Production compose file"
  Assert-File -Path $NgrokComposePath -Label "Ngrok compose file"

  Write-Host "Env file: $EnvFilePath"
  Write-Host "Release file: $ReleaseFilePath"
  Write-Host "Output root: $OutputRootPath"
  Write-Host "Compose project: $ComposeProjectName"
  Write-Host "Volumes:"
  foreach ($volume in $fullVolumeNames) {
    Write-Host "  $volume"
  }
  if ($SkipDbDump) {
    Write-Host "DB dump: skipped"
  }
  else {
    Write-Host "DB dump: mjuclaw-public-data-db"
  }
}

if ($CheckOnly) {
  Write-Host ""
  Write-Host "Check-only completed. No backup files were created."
  exit 0
}

Invoke-Step "Checking Docker state" {
  Assert-DockerDaemon
  foreach ($volume in $fullVolumeNames) {
    Assert-DockerVolume -Name $volume
  }
  if (-not $SkipDbDump) {
    Assert-ContainerRunning -Name "mjuclaw-public-data-db"
  }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $OutputRootPath $timestamp
$artifacts = [System.Collections.ArrayList]::new()

Invoke-Step "Creating backup directory" {
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
  Write-Host $BackupRoot
}

Invoke-Step "Copying configuration files" {
  Copy-BackupFile -Source $EnvFilePath -Destination (Join-Path $BackupRoot ".env.production") -Kind "env" -Artifacts $artifacts
  Copy-BackupFile -Source $ReleaseFilePath -Destination (Join-Path $BackupRoot "release.env") -Kind "release" -Artifacts $artifacts
  Copy-BackupFile -Source $ProdComposePath -Destination (Join-Path $BackupRoot "docker-compose.prod.yml") -Kind "compose" -Artifacts $artifacts
  Copy-BackupFile -Source $NgrokComposePath -Destination (Join-Path $BackupRoot "docker-compose.ngrok.yml") -Kind "compose" -Artifacts $artifacts
}

Invoke-Step "Exporting Docker volumes" {
  foreach ($name in $volumeNames) {
    $volume = "${ComposeProjectName}_${name}"
    $archiveName = "$name.tar.gz"
    Invoke-Docker -Arguments @(
      "run", "--rm",
      "--mount", "type=volume,source=$volume,target=/data,readonly",
      "--mount", "type=bind,source=$BackupRoot,target=/backup",
      "alpine", "sh", "-c", "cd /data && tar czf /backup/$archiveName ."
    )
    Add-Artifact -Artifacts $artifacts -Path (Join-Path $BackupRoot $archiveName) -Kind "volume"
  }
}

if (-not $SkipDbDump) {
  Invoke-Step "Dumping public data DB" {
    $containerDumpPath = "/tmp/public-data-db.dump"
    $localDumpPath = Join-Path $BackupRoot "public-data-db.dump"
    Invoke-Docker -Arguments @(
      "exec", "mjuclaw-public-data-db",
      "sh", "-c", "pg_dump -U ""`$POSTGRES_USER"" -d ""`$POSTGRES_DB"" -Fc -f $containerDumpPath"
    )
    Invoke-Docker -Arguments @("cp", "mjuclaw-public-data-db:$containerDumpPath", $localDumpPath)
    Invoke-Docker -Arguments @("exec", "mjuclaw-public-data-db", "rm", "-f", $containerDumpPath)
    Add-Artifact -Artifacts $artifacts -Path $localDumpPath -Kind "database"
  }
}

Invoke-Step "Writing backup manifest" {
  $manifest = [ordered]@{
    status = "succeeded"
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    gitCommit = Get-GitCommit
    envFile = $EnvFile
    releaseFile = $ReleaseFile
    outputRoot = $OutputRoot
    composeProjectName = $ComposeProjectName
    skippedDbDump = [bool]$SkipDbDump
    includedPaddleModels = [bool]$IncludePaddleModels
    volumes = $volumeNames
    artifacts = $artifacts
  }

  $manifestPath = Join-Path $BackupRoot "backup.json"
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -Path $manifestPath
  Write-Host $manifestPath
}

Write-Host ""
Write-Host "Backup completed: $BackupRoot"
