# PowerShell script to clear test data via API
# Usage: .\clear-test-data.ps1

$apiUrl = $env:API_URL
if (-not $apiUrl) {
    # Default to production backend URL
    $apiUrl = "https://kdsmenu-production.up.railway.app"
    Write-Host "Using default backend URL: $apiUrl" -ForegroundColor Cyan
} else {
    Write-Host "Using API_URL from environment: $apiUrl" -ForegroundColor Cyan
}

$endpoint = "$apiUrl/api/admin/clear-test-data"

Write-Host "Calling: $endpoint" -ForegroundColor Cyan
Write-Host "This will delete ALL orders and revenue data!" -ForegroundColor Red
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json"
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

