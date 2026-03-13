Write-Host "Railway Backend Setup" -ForegroundColor Green
Write-Host ""
Write-Host "1. Go to https://railway.app" -ForegroundColor White
Write-Host "2. New Project -> Deploy from GitHub -> Select your samplemenu repo" -ForegroundColor White
Write-Host "3. Set Root Directory to: backend" -ForegroundColor White
Write-Host "4. Add PostgreSQL database" -ForegroundColor White
Write-Host "5. Set environment variables (see backend/.env.example)" -ForegroundColor White
Write-Host ""
Write-Host "After deployment, get your backend URL and set in Vercel:" -ForegroundColor Cyan
Write-Host "  vercel env add VITE_API_URL production" -ForegroundColor White
Write-Host "  vercel env add VITE_SOCKET_URL production" -ForegroundColor White
