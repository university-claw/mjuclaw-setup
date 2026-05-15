[CmdletBinding()]
param(
  [string]$EnvFile = ".env.production",
  [string]$ReleaseFile = "release.env",
  [switch]$Ngrok,
  [switch]$PullOnly,
  [switch]$NoPull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($PullOnly -and $NoPull) {
  throw "-PullOnly and -NoPull cannot be used together."
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

$envFilePath = Resolve-RepoPath $EnvFile
$releaseFilePath = Resolve-RepoPath $ReleaseFile
$prodComposePath = Resolve-RepoPath "docker-compose.prod.yml"
$ngrokComposePath = Resolve-RepoPath "docker-compose.ngrok.yml"

$composeArgs = @(
  "compose",
  "--env-file", $envFilePath,
  "--env-file", $releaseFilePath,
  "-f", $prodComposePath
)

if ($Ngrok) {
  $composeArgs += @("-f", $ngrokComposePath, "--profile", "ngrok")
}

Push-Location $Root
try {
  Invoke-Step "Checking prerequisites" {
    Assert-Command "docker"
    Assert-File $envFilePath "env file"
    Assert-File $releaseFilePath "release file"
    Assert-File $prodComposePath "docker-compose.prod.yml"
    if ($Ngrok) {
      Assert-File $ngrokComposePath "docker-compose.ngrok.yml"
    }

    Invoke-Docker -Arguments @("info", "--format", "{{.ServerVersion}}")
    Invoke-Docker -Arguments @("compose", "version")
    Assert-ReleaseFileIsPinned $releaseFilePath
  }

  Invoke-Step "Validating compose configuration" {
    Invoke-Docker ($composeArgs + @("config", "--quiet"))
  }

  if (-not $NoPull) {
    Invoke-Step "Pulling images" {
      Invoke-Docker ($composeArgs + @("pull"))
    }
  }

  if ($PullOnly) {
    Write-Host ""
    Write-Host "Pull complete. Skipping service start because -PullOnly was set."
    return
  }

  Invoke-Step "Starting services" {
    Invoke-Docker ($composeArgs + @("up", "-d"))
  }

  Invoke-Step "Current service status" {
    Invoke-Docker ($composeArgs + @("ps"))
  }

  Write-Host ""
  Write-Host "Deployment command completed."
  Write-Host ""
  Write-Host "Suggested health checks:"
  Write-Host "  docker exec mjuclaw-agent curl -sS http://localhost:3001/health"
  Write-Host "  docker exec mjuclaw-router curl -sS http://localhost:3100/healthz"
  Write-Host "  docker exec mjuclaw-classifier curl -sS http://localhost:3200/healthz"
  Write-Host "  docker logs mjuclaw-worker --tail 20"
}
finally {
  Pop-Location
}
