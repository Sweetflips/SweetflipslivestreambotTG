param(
    [switch] $Force
)
$ErrorActionPreference = "Stop"
$docker = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
if (-not (Test-Path $docker)) { $docker = "docker" }

if (-not $Force) {
    $c = Read-Host "Leave Swarm on this node? Type YES"
    if ($c -ne "YES") { Write-Host "Aborted."; exit 0 }
}
& $docker swarm leave --force
Write-Host "Done. Swarm state cleared; you can join again after fixing connectivity."
