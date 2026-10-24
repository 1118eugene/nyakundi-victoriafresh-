$ErrorActionPreference = 'Stop'
$b = 'http://127.0.0.1:5000/api'
Write-Host "--- Docker ---"
docker ps --format "table {{.Names}}`t{{.Status}}"
Write-Host "--- Restart policy ---"
docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' nyakundi-db-1
Write-Host "--- Local health ---"
Invoke-RestMethod "$b/health" | ConvertTo-Json -Compress
Write-Host "--- Catalogue ---"
$r = Invoke-RestMethod "$b/products?limit=100"
"Total: " + $r.pagination.total
$r.data | Group-Object category | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
"With photo: " + @($r.data | Where-Object { $_.image }).Count
"Price pending: " + @($r.data | Where-Object { -not $_.priceConfirmed }).Count
Write-Host "--- Live Render health ---"
Invoke-RestMethod "https://nyakundi-victoriafresh-2.onrender.com/api/health" -TimeoutSec 60 | ConvertTo-Json -Compress
