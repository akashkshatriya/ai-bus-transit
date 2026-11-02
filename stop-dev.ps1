Write-Host "Stopping Bus Tracker dev services on ports 8000 and 5173..." -ForegroundColor Yellow

$ports = @(8000, 5173)
foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                if ($c.OwningProcess -and $c.OwningProcess -gt 0) {
                    Write-Host "Stopping PID $($c.OwningProcess) on port $port..." -ForegroundColor Yellow
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        # ignore errors if already closed
    }
}

Write-Host "Services stopped successfully." -ForegroundColor Green
