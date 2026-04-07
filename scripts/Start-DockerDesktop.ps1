# Starts Docker Desktop if the Linux engine is not reachable, then waits until `docker version` shows a server.
$ErrorActionPreference = "Stop"
$docker = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) {
    Write-Error "Docker CLI not found at $docker"
}
function Test-DockerEngine {
    try {
        $o = & $docker version 2>&1 | Out-String
        return $o -match "(?m)^Server:"
    } catch {
        return $false
    }
}
if (Test-DockerEngine) {
    Write-Host "Docker engine already running."
    exit 0
}
$exe = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (-not (Test-Path $exe)) {
    Write-Error "Docker Desktop not found at $exe"
}
Start-Process -FilePath $exe
Write-Host "Waiting for Docker engine (up to 120s)..."
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    if (Test-DockerEngine) {
        Write-Host "Docker engine is up."
        exit 0
    }
}
Write-Error "Docker engine did not become ready. Open Docker Desktop and check for errors, or restart Windows."
