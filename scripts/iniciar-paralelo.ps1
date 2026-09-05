# Script de Inicializacao Paralela dos Agentes Claude Code
# Cada frente roda em um git worktree separado (diretorio proprio),
# entao um "git checkout" em uma aba NAO afeta as outras.

$ErrorActionPreference = "Stop"

$root = (Get-Item -Path ".\").FullName
$wtBase = Join-Path (Split-Path $root -Parent) "portal-gundam-tcg-br-worktrees"

# Frentes que rodam em worktree dedicado (Terminal 1 fica no repo principal em 'dev')
$fronts = @(
    @{ Branch = "feature/simulator-layout";    Dir = (Join-Path $wtBase "simulator-layout") }
    @{ Branch = "feature/simulator-websocket"; Dir = (Join-Path $wtBase "simulator-websocket") }
)

function Invoke-PnpmInstall($dir) {
    Push-Location $dir
    try {
        if (Get-Command pnpm -ErrorAction SilentlyContinue) {
            pnpm install
        } elseif (Get-Command corepack -ErrorAction SilentlyContinue) {
            corepack pnpm install
        } else {
            Write-Host "  AVISO: pnpm/corepack nao encontrados. Rode 'pnpm install' manualmente em $dir" -ForegroundColor Red
        }
    } catch {
        Write-Host "  AVISO: falha ao instalar dependencias em $dir -- rode 'pnpm install' manualmente." -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

function Ensure-Worktree($branch, $dir) {
    if (-not (Test-Path $dir)) {
        Write-Host "  criando worktree $branch -> $dir" -ForegroundColor Yellow
        git -C $root worktree add $dir $branch
    } else {
        Write-Host "  worktree ja existe: $dir" -ForegroundColor DarkGray
    }
    # .env e .spartan/ai.env sao gitignored -> o checkout do worktree nao os traz.
    # Sem .env, `prisma` e o servidor quebram com "Environment variable not found: DATABASE_URL".
    foreach ($rel in @(".env", ".spartan/ai.env")) {
        $src = Join-Path $root $rel
        $dst = Join-Path $dir $rel
        if ((Test-Path $src) -and (-not (Test-Path $dst))) {
            New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
            Copy-Item $src $dst
            Write-Host "  copiado $rel -> worktree" -ForegroundColor DarkGray
        }
    }
    if (-not (Test-Path (Join-Path $dir "node_modules"))) {
        Write-Host "  instalando dependencias (pnpm) em $dir ..." -ForegroundColor Yellow
        Invoke-PnpmInstall $dir
    }
}

Write-Host "Preparando worktrees..." -ForegroundColor Cyan

# Garante que o repo principal esta em 'dev' antes de liberar as branches para worktree
git -C $root checkout dev

foreach ($f in $fronts) {
    Ensure-Worktree $f.Branch $f.Dir
}

$layoutDir    = ($fronts | Where-Object { $_.Branch -eq "feature/simulator-layout" }).Dir
$websocketDir = ($fronts | Where-Object { $_.Branch -eq "feature/simulator-websocket" }).Dir

Write-Host "Iniciando 3 terminais paralelos do Claude Code para o Portal Gundam TCG BR..." -ForegroundColor Cyan

if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
    wt -w 0 new-tab -d "$root" -p "Windows PowerShell" powershell -NoExit -Command "Write-Host '==================================================' -ForegroundColor Green; Write-Host ' TERMINAL 1: CORE, TRADUCAO E ST03/ST04 (dev)' -ForegroundColor Green; Write-Host ' Digite: /iniciar-execucao' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Green; claude" `; `
       new-tab -d "$layoutDir" -p "Windows PowerShell" powershell -NoExit -Command "Write-Host '==================================================' -ForegroundColor Cyan; Write-Host ' TERMINAL 2: LAYOUT, PLAYMAT E ERGONOMIA HUD' -ForegroundColor Cyan; Write-Host ' worktree: feature/simulator-layout' -ForegroundColor DarkGray; Write-Host ' Digite: /iniciar-execucao' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Cyan; claude" `; `
       new-tab -d "$websocketDir" -p "Windows PowerShell" powershell -NoExit -Command "Write-Host '==================================================' -ForegroundColor Magenta; Write-Host ' TERMINAL 3: WEBSOCKET E MULTIPLAYER EM TEMPO REAL' -ForegroundColor Magenta; Write-Host ' worktree: feature/simulator-websocket' -ForegroundColor DarkGray; Write-Host ' Digite: /iniciar-execucao' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Magenta; claude"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; Write-Host 'TERMINAL 1: CORE / DEV' -ForegroundColor Green; Write-Host 'Digite: /iniciar-execucao' -ForegroundColor Yellow; claude"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$layoutDir'; Write-Host 'TERMINAL 2: LAYOUT (worktree)' -ForegroundColor Cyan; Write-Host 'Digite: /iniciar-execucao' -ForegroundColor Yellow; claude"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$websocketDir'; Write-Host 'TERMINAL 3: WEBSOCKET (worktree)' -ForegroundColor Magenta; Write-Host 'Digite: /iniciar-execucao' -ForegroundColor Yellow; claude"
}
