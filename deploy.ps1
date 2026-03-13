# Deploy frontend to Vercel
# First time only: run "vercel login" and complete the browser auth
# Then run: .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "Deploying frontend..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\frontend

# Deploy (will use existing login or prompt)
npx vercel --prod --yes

Write-Host ""
Write-Host "Done." -ForegroundColor Green
