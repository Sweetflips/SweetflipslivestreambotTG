param(
    [Parameter(Mandatory = $true)]
    [string] $Token,
    [Parameter(Mandatory = $false)]
    [string] $Manager = "10.0.1.69:2377"
)
$ErrorActionPreference = "Stop"
$docker = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) {
    $docker = "docker"
}
& $docker swarm join --token $Token $Manager
