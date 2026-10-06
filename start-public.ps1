# Публичная ссылка на сайт (работает с любого Wi‑Fi, пока компьютер включён)
# Запуск: дважды кликни этот файл или выполни в PowerShell:
#   powershell -ExecutionPolicy Bypass -File start-public.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflared = Join-Path $root "tools\cloudflared.exe"
$port = 8765

if (-not (Test-Path $cloudflared)) {
  Write-Host "Скачиваю cloudflared..."
  New-Item -ItemType Directory -Force -Path (Join-Path $root "tools") | Out-Null
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflared -UseBasicParsing
}

# Локальный сервер, если ещё не запущен
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $root 'start-server.ps1')`"" -WindowStyle Minimized
  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Открываю публичный доступ. Ссылку ищи ниже (https://....trycloudflare.com)"
Write-Host "Оставь это окно открытым, пока кто-то смотрит сайт."
Write-Host ""

& $cloudflared tunnel --url "http://127.0.0.1:$port" --no-autoupdate
