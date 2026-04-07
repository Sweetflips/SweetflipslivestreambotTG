param(
    [Parameter(Mandatory = $true)]
    [string] $Token,
    [Parameter(Mandatory = $false, HelpMessage = "Manager listen address, e.g. 10.0.1.69:2377. Or set env SWARM_MANAGER.")]
    [string] $Manager = $env:SWARM_MANAGER,
    [string] $AdvertiseAddr,
    [string] $ListenAddr,
    [switch] $SkipConnectivityCheck
)
$ErrorActionPreference = "Stop"
if (-not $Manager) {
    throw "Set -Manager 'host:2377' or environment variable SWARM_MANAGER to your swarm manager address."
}

$docker = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) {
    $docker = "docker"
}

if (-not $SkipConnectivityCheck) {
    $testScript = Join-Path $PSScriptRoot "Test-SwarmConnectivity.ps1"
    if (Test-Path $testScript) {
        & $testScript -Manager $Manager
    }
}

$args = @("swarm", "join", "--token", $Token)
if ($AdvertiseAddr) {
    $args += @("--advertise-addr", $AdvertiseAddr)
}
if ($ListenAddr) {
    $args += @("--listen-addr", $ListenAddr)
}
$args += $Manager

Write-Host "Running: docker swarm join ... $Manager" -ForegroundColor Cyan
& $docker @args
