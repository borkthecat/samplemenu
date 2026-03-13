# PowerShell script to clear data for venue 1 (PROOST) only
# Usage: .\clear-venue-1-data.ps1

$apiUrl = $env:API_URL
if (-not $apiUrl) {
    # Default to production backend URL
    $apiUrl = "https://kdsmenu-production.up.railway.app"
    Write-Host "Using default backend URL: $apiUrl" -ForegroundColor Cyan
} else {
    Write-Host "Using API_URL from environment: $apiUrl" -ForegroundColor Cyan
}

$endpoint = "$apiUrl/api/admin/clear-venue-data"

Write-Host "Calling: $endpoint" -ForegroundColor Cyan
Write-Host "This will delete ALL orders and revenue data for venue 1 (PROOST) ONLY!" -ForegroundColor Red
Write-Host "Venue 2 and 3 will NOT be affected." -ForegroundColor Yellow
Write-Host "Menu catalog (menu items) will NOT be deleted - only orders and revenue." -ForegroundColor Green
Write-Host ""

$body = @{
    venue_id = "001"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" -Body $body
    
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

