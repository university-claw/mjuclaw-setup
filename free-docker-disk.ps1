Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-DiskUsage {
  Write-Host "Filesystem usage:"
  Get-PSDrive -PSProvider FileSystem |
    Select-Object Name, Used, Free, Root |
    Format-Table -AutoSize |
    Out-String |
    Write-Host
}

function Clear-DirectoryContents {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    return
  }

  Write-Host "Clearing directory contents: $Path"
  Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

function Invoke-NativeWithTimeout {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [int]$TimeoutSeconds = 120
  )

  Write-Host "> $FilePath $($Arguments -join ' ')"

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo.FileName = $FilePath
  $process.StartInfo.Arguments = ($Arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_ -replace '"', '\"') + '"'
    }
    else {
      $_
    }
  }) -join " "
  $process.StartInfo.UseShellExecute = $false

  [void]$process.Start()

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try {
      $process.Kill()
    }
    catch {
      Write-Warning "Failed to kill timed out process: $_"
    }
    throw "$FilePath $($Arguments -join ' ') did not finish within $TimeoutSeconds seconds. The Docker daemon may be unresponsive or the host disk may be full."
  }

  if ($process.ExitCode -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $($process.ExitCode)."
  }
}

function Test-DockerEngine {
  try {
    Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("info") -TimeoutSeconds 30
    return $true
  }
  catch {
    Write-Warning "Docker engine is not responding: $_"
    return $false
  }
}

function Start-DockerDesktop {
  $candidates = New-Object System.Collections.Generic.List[string]

  if ($env:ProgramFiles) {
    $candidates.Add((Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"))
  }
  if (${env:ProgramFiles(x86)}) {
    $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Docker\Docker\Docker Desktop.exe"))
  }
  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Docker\Docker Desktop.exe"))
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker\Docker Desktop.exe"))
  }

  $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
  if ($dockerCommand) {
    Write-Host "Docker CLI path: $($dockerCommand.Source)"
    $directory = Get-Item -LiteralPath (Split-Path -Parent $dockerCommand.Source)
    while ($directory) {
      $candidates.Add((Join-Path $directory.FullName "Docker Desktop.exe"))
      $directory = $directory.Parent
    }
  }

  $dockerDesktopPath = $candidates |
    Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
    Select-Object -First 1

  if (-not $dockerDesktopPath) {
    Write-Warning "Docker Desktop executable was not found in known locations."
    return
  }

  Write-Host "Starting Docker Desktop: $dockerDesktopPath"
  Start-Process -FilePath $dockerDesktopPath | Out-Null
}

function Restart-DockerEngine {
  Write-Host "Restarting Docker engine before production Docker commands."

  $dockerServices = Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*docker*" -or $_.DisplayName -like "*docker*" }
  if ($dockerServices) {
    Write-Host "Docker-related services:"
    $dockerServices | Format-Table -AutoSize | Out-String | Write-Host
  }

  $service = $dockerServices | Where-Object { $_.Name -eq "com.docker.service" } | Select-Object -First 1
  if ($service) {
    Restart-Service -Name "com.docker.service" -Force -ErrorAction Stop
  }
  else {
    Write-Warning "Docker service com.docker.service was not found."
  }

  Start-DockerDesktop
}

function Wait-DockerEngine {
  param(
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-DockerEngine) {
      Write-Host "Docker engine is responding."
      return
    }

    Start-Sleep -Seconds 10
  }

  throw "Docker engine did not become ready within $TimeoutSeconds seconds."
}

Show-DiskUsage

if ($env:RUNNER_TEMP) {
  Clear-DirectoryContents -Path $env:RUNNER_TEMP
}

Show-DiskUsage

if (-not (Test-DockerEngine)) {
  Restart-DockerEngine
  Wait-DockerEngine -TimeoutSeconds 420
}

Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("builder", "prune", "-af") -TimeoutSeconds 120
Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("image", "prune", "-af") -TimeoutSeconds 120
Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("container", "prune", "-f") -TimeoutSeconds 120
Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("system", "df") -TimeoutSeconds 120

Show-DiskUsage
