# Script de Inicialização da Suite Zero System (Fase 2 Conclusão)
# Terminal 1 (Backend Core & IA) no repo principal
# Terminal 2 (Frontend & Tactical UI/UX) em worktree dedicado

$ErrorActionPreference = "Stop"

$root = (Get-Item -Path ".\").FullName
$wtBase = Join-Path (Split-Path $root -Parent) "portal-gundam-tcg-br-worktrees"
$frontendDir = Join-Path $wtBase "zero-system-frontend"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " Inicializando Worktrees para a Suite Zero System" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Garante branch feature/zero-system-backend no repo principal
$b1 = git -C $root branch --list "feature/zero-system-backend"
if (-not $b1) {
    git -C $root branch "feature/zero-system-backend" dev
    Write-Host "  Branch 'feature/zero-system-backend' criada a partir de dev." -ForegroundColor Green
}

# 2. Garante branch feature/zero-system-frontend e seu worktree
$b2 = git -C $root branch --list "feature/zero-system-frontend"
if (-not $b2) {
    git -C $root branch "feature/zero-system-frontend" dev
    Write-Host "  Branch 'feature/zero-system-frontend' criada a partir de dev." -ForegroundColor Green
}

if (-not (Test-Path $frontendDir)) {
    Write-Host "  Criando worktree para frontend em $frontendDir..." -ForegroundColor Yellow
    git -C $root worktree add $frontendDir feature/zero-system-frontend
} else {
    Write-Host "  Worktree frontend já existe: $frontendDir" -ForegroundColor DarkGray
}

# Copia .env e .spartan se existirem
foreach ($rel in @(".env", ".spartan/ai.env")) {
    $src = Join-Path $root $rel
    $dst = Join-Path $frontendDir $rel
    if ((Test-Path $src) -and (-not (Test-Path $dst))) {
        New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
        Copy-Item $src $dst
        Write-Host "  Copiado $rel para o worktree frontend." -ForegroundColor DarkGray
    }
}

Write-Host "`nAmbiente configurado com sucesso!" -ForegroundColor Green
Write-Host "  Terminal 1 (Backend - Gemini): $root (feature/zero-system-backend)" -ForegroundColor White
Write-Host "  Terminal 2 (Frontend - Claude): $frontendDir (feature/zero-system-frontend)" -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Cyan
