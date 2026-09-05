# Script de Inicialização Paralela dos Agentes Claude Code
# Executa 3 instâncias separadas com suas respectivas branches

$root = (Get-Item -Path ".\").FullName

Write-Host "Iniciando 3 terminais paralelos do Claude Code para o Portal Gundam TCG BR..." -ForegroundColor Cyan

if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
    wt -w 0 new-tab -d "$root" -p "Windows PowerShell" powershell -NoExit -Command "git checkout dev; Write-Host '==================================================' -ForegroundColor Green; Write-Host ' TERMINAL 1: CORE, TRADUCAO E ST03/ST04 (dev)' -ForegroundColor Green; Write-Host ' Digite: /iniciar-execucao' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Green; claude" `; `
       new-tab -d "$root" -p "Windows PowerShell" powershell -NoExit -Command "git checkout feature/simulator-layout; Write-Host '==================================================' -ForegroundColor Cyan; Write-Host ' TERMINAL 2: LAYOUT, PLAYMAT E ERGONOMIA HUD' -ForegroundColor Cyan; Write-Host ' Digite: /iniciar-execucao' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Cyan; claude" `; `
       new-tab -d "$root" -p "Windows PowerShell" powershell -NoExit -Command "git checkout feature/simulator-websocket; Write-Host '==================================================' -ForegroundColor Magenta; Write-Host ' TERMINAL 3: WEBSOCKET E MULTIPLAYER EM TEMPO REAL' -ForegroundColor Magenta; Write-Host ' Digite: /iniciar-execucao' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Magenta; claude"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; git checkout dev; Write-Host 'TERMINAL 1: CORE / DEV' -ForegroundColor Green; Write-Host 'Digite: /iniciar-execucao' -ForegroundColor Yellow; claude"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; git checkout feature/simulator-layout; Write-Host 'TERMINAL 2: LAYOUT' -ForegroundColor Cyan; Write-Host 'Digite: /iniciar-execucao' -ForegroundColor Yellow; claude"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; git checkout feature/simulator-websocket; Write-Host 'TERMINAL 3: WEBSOCKET' -ForegroundColor Magenta; Write-Host 'Digite: /iniciar-execucao' -ForegroundColor Yellow; claude"
}
