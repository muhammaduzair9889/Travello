# Start React Frontend Server
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Starting Travello Frontend Application..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure the backend is running at http://localhost:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "D:\Travello Project\Travello Project\frontend"
npm start
