param(
    [Parameter(Mandatory = $true, HelpMessage = "Manager address, e.g. 10.0.1.69:2377")]
    [string] $Manager
)
$ErrorActionPreference = "Stop"
if ($Manager -match "^([^:]+):(\d+)$") {
    $hostOnly = $Matches[1]
    $port = [int]$Matches[2]
} elseif ($Manager -match "^([^:]+)$") {
    $hostOnly = $Matches[1]
    $port = 2377
} else {
    throw "Invalid -Manager. Use 'host:2377' or 'host'."
}

Write-Host "Testing TCP to ${hostOnly}:${port} (swarm manager)..." -ForegroundColor Cyan
$t = Test-NetConnection -ComputerName $hostOnly -Port $port -WarningAction SilentlyContinue
Write-Host "  TcpTestSucceeded: $($t.TcpTestSucceeded)"
Write-Host "  PingSucceeded:    $($t.PingSucceeded)  (ICMP may be blocked even when TCP works)"
if (-not $t.TcpTestSucceeded) {
    Write-Host ""
    Write-Host "This PC cannot reach the manager on TCP $port." -ForegroundColor Yellow
    Write-Host "  - Join the VPN / Tailscale / same LAN as the manager."
    Write-Host "  - Confirm firewall on the manager allows inbound TCP 2377 from workers."
    Write-Host "  - Use the manager address workers are meant to use (public, VPN, or LAN IP)."
    throw "Swarm connectivity check failed."
}
Write-Host "OK: Port is reachable. You can run Join-DockerSwarm.ps1 next." -ForegroundColor Green
