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

Show-DiskUsage

if ($env:RUNNER_TEMP) {
  Clear-DirectoryContents -Path $env:RUNNER_TEMP
}

Show-DiskUsage

Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("builder", "prune", "-af") -TimeoutSeconds 120
Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("image", "prune", "-af") -TimeoutSeconds 120
Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("container", "prune", "-f") -TimeoutSeconds 120
Invoke-NativeWithTimeout -FilePath "docker" -Arguments @("system", "df") -TimeoutSeconds 120

Show-DiskUsage
