# Script de Inicializacao Paralela Multi-Agente - FASE 3 (Ciclo v2.1)
# Antigravity (Gemini) + Claude Code CLI + Data & AI Specialist
# Cada frente roda em um git worktree separado (diretorio proprio),
# garantindo isolamento total sem interferencia de commits ou checkouts.

param(
    [switch]$SkipTerminal3
)

$ErrorActionPreference = "Stop"

$root = (Get-Item -Path ".\").FullName
$wtBase = Join-Path (Split-Path $root -Parent) "portal-gundam-tcg-br-worktrees"

# Frentes da Fase 3 que rodam em worktree dedicado:
# (Terminal 1 opera no repo principal na branch 'feature/wave-gd03-zeropilot')
$fronts = @(
    @{ Branch = "feature/hub2-multiplayer4p";    Dir = (Join-Path $wtBase "hub2-multiplayer4p") }
    @{ Branch = "feature/foresight-regional-meta"; Dir = (Join-Path $wtBase "foresight-regional-meta") }
)

$promptT1File = Join-Path $root "scripts\prompts\terminal-1-core-gd03-zeropilot.txt"
$promptT2File = Join-Path $root "scripts\prompts\terminal-2-frontend-hub2-multiplayer.txt"
$promptT3File = Join-Path $root "scripts\prompts\terminal-3-foresight-regional-meta.txt"
$doc55Path    = Join-Path $root "docs\55-guia-execucao-multiagente-e-prompts.md"

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
        Write-Host "  Criando worktree $branch -> $dir" -ForegroundColor Yellow
        $branchExists = git -C $root branch --list $branch
        if (-not $branchExists) {
            git -C $root branch $branch dev
        }
        git -C $root worktree add $dir $branch
    } else {
        Write-Host "  Worktree ja existe: $dir" -ForegroundColor DarkGray
    }
    # .env e .spartan/ai.env sao gitignored -> o checkout do worktree nao os traz.
    foreach ($rel in @(".env", ".spartan/ai.env")) {
        $src = Join-Path $root $rel
        $dst = Join-Path $dir $rel
        if ((Test-Path $src) -and (-not (Test-Path $dst))) {
            New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
            Copy-Item $src $dst
            Write-Host "  Copiado $rel -> worktree" -ForegroundColor DarkGray
        }
    }
    if (-not (Test-Path (Join-Path $dir "node_modules"))) {
        Write-Host "  Instalando dependencias (pnpm) em $dir ..." -ForegroundColor Yellow
        Invoke-PnpmInstall $dir
    }
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " Preparando Ambiente Multi-Agente - FASE 3 (Ciclo v2.1)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Garante a branch feature/wave-gd03-zeropilot para o Terminal 1 no repo principal
$gd03BranchExists = git -C $root branch --list "feature/wave-gd03-zeropilot"
if (-not $gd03BranchExists) {
    git -C $root branch "feature/wave-gd03-zeropilot" dev
}
git -C $root checkout feature/wave-gd03-zeropilot

# 2. Provisiona os worktrees isolados para Terminal 2 e Terminal 3
foreach ($f in $fronts) {
    Ensure-Worktree $f.Branch $f.Dir
}

$hubDir       = ($fronts | Where-Object { $_.Branch -eq "feature/hub2-multiplayer4p" }).Dir
$foresightDir = ($fronts | Where-Object { $_.Branch -eq "feature/foresight-regional-meta" }).Dir

# 3. Disparo automatico do TERMINAL 1 no Google Antigravity (Gemini)
Write-Host ""
Write-Host "------------------------------------------------------------------" -ForegroundColor Green
Write-Host " DISPARO TERMINAL 1: Google Antigravity (Gemini) -> GD03 & Zero Pilot N4" -ForegroundColor Green
Write-Host "------------------------------------------------------------------" -ForegroundColor Green

$antigravityCmd = (Get-Command antigravity-ide.cmd -ErrorAction SilentlyContinue).Source
if (-not $antigravityCmd) {
    $fallbackPath = "C:\Users\uriuj\AppData\Local\Programs\Antigravity IDE\bin\antigravity-ide.cmd"
    if (Test-Path $fallbackPath) { $antigravityCmd = $fallbackPath }
}

if ($antigravityCmd -and (Test-Path $promptT1File)) {
    $promptT1 = Get-Content -Raw -Encoding UTF8 $promptT1File
    Write-Host "  Invocando Antigravity IDE em modo agente com o prompt do Terminal 1..." -ForegroundColor Green
    try {
        if (Test-Path $doc55Path) {
            Start-Process -FilePath $antigravityCmd -ArgumentList "chat", "-r", "-m", "agent", "-a", "`"$doc55Path`"", "`"$promptT1`""
        } else {
            Start-Process -FilePath $antigravityCmd -ArgumentList "chat", "-r", "-m", "agent", "`"$promptT1`""
        }
        Write-Host "  [OK] Sessao do Antigravity (Gemini) acionada no repo principal (feature/wave-gd03-zeropilot)!" -ForegroundColor Green
    } catch {
        Write-Host "  [AVISO] Falha ao acionar antigravity-ide.cmd: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  Abra o chat do Antigravity manualmente e cole: scripts\prompts\terminal-1-core-gd03-zeropilot.txt" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [AVISO] antigravity-ide.cmd nao localizado no PATH. Cole o prompt de scripts\prompts\terminal-1-core-gd03-zeropilot.txt no chat." -ForegroundColor Yellow
}

# 4. Disparo automatico do TERMINAL 2 e TERMINAL 3 no Claude Code CLI
Write-Host ""
Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " DISPARO TERMINAL 2 & 3: Claude Code CLI -> Hub Wave 2, 4P & Foresight" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
    Write-Host "  Abrindo abas dedicadas no Windows Terminal..." -ForegroundColor Cyan

    $cmdT1 = "Write-Host '==================================================' -ForegroundColor Green; Write-Host ' TERMINAL 1 (MONITOR): GD03, TOKENS & ZERO PILOT N4' -ForegroundColor Green; Write-Host ' Agente: Google Antigravity (Gemini) [Ativo no IDE]' -ForegroundColor DarkGray; Write-Host ' Branch: feature/wave-gd03-zeropilot' -ForegroundColor DarkGray; Write-Host ' Use este terminal para: pnpm test | pnpm gundam:fuzz | pnpm check:types' -ForegroundColor DarkGray; Write-Host '==================================================' -ForegroundColor Green"

    $cmdT2 = "Write-Host '==================================================' -ForegroundColor Cyan; Write-Host ' TERMINAL 2: UNIVERSE HUB WAVE 2 (00/WFM) & ARENA 4P' -ForegroundColor Cyan; Write-Host ' Agente: Anthropic Claude Code CLI' -ForegroundColor DarkGray; Write-Host ' Worktree: feature/hub2-multiplayer4p' -ForegroundColor DarkGray; Write-Host ' Disparando Claude Code com prompt canonico...' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Cyan; `$p = Get-Content -Raw -Encoding UTF8 '$promptT2File'; claude `$p"

    $cmdT3 = "Write-Host '==================================================' -ForegroundColor Magenta; Write-Host ' TERMINAL 3: ZERO FORESIGHT (MONTE CARLO) & REGIONAL META' -ForegroundColor Magenta; Write-Host ' Agente: Claude / Gemini (Data & AI Specialist)' -ForegroundColor DarkGray; Write-Host ' Worktree: feature/foresight-regional-meta' -ForegroundColor DarkGray; Write-Host ' Disparando Claude Code com prompt canonico...' -ForegroundColor Yellow; Write-Host '==================================================' -ForegroundColor Magenta; `$p = Get-Content -Raw -Encoding UTF8 '$promptT3File'; claude `$p"

    if ($SkipTerminal3) {
        wt -w 0 new-tab -d "$root" -p "Windows PowerShell" powershell -NoExit -Command $cmdT1 `; `
           new-tab -d "$hubDir" -p "Windows PowerShell" powershell -NoExit -Command $cmdT2
    } else {
        wt -w 0 new-tab -d "$root" -p "Windows PowerShell" powershell -NoExit -Command $cmdT1 `; `
           new-tab -d "$hubDir" -p "Windows PowerShell" powershell -NoExit -Command $cmdT2 `; `
           new-tab -d "$foresightDir" -p "Windows PowerShell" powershell -NoExit -Command $cmdT3
    }
} else {
    Write-Host "  wt.exe nao encontrado. Abrindo janelas separadas do PowerShell..." -ForegroundColor Yellow
    
    # Janela Terminal 1
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; Write-Host 'TERMINAL 1: GD03 & ZERO PILOT N4 (Gemini ativo no IDE)' -ForegroundColor Green"
    
    # Janela Terminal 2
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$hubDir'; Write-Host 'TERMINAL 2: HUB WAVE 2 & MULTIPLAYER 4P' -ForegroundColor Cyan; `$p = Get-Content -Raw -Encoding UTF8 '$promptT2File'; claude `$p"
    
    # Janela Terminal 3
    if (-not $SkipTerminal3) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$foresightDir'; Write-Host 'TERMINAL 3: ZERO FORESIGHT & REGIONAL META' -ForegroundColor Magenta; `$p = Get-Content -Raw -Encoding UTF8 '$promptT3File'; claude `$p"
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Orquestracao Multi-Agente Fase 3 inicializada com sucesso!" -ForegroundColor Green
Write-Host " - Terminal 1: Antigravity IDE (Gemini) -> GD03 + Zero Pilot N4" -ForegroundColor Green
Write-Host " - Terminal 2: Claude Code CLI -> Hub Wave 2 + Arena 4P (Worktree /hub2-multiplayer4p)" -ForegroundColor Cyan
if (-not $SkipTerminal3) {
    Write-Host " - Terminal 3: Claude Code CLI -> Foresight 10k + Metagame Regional (Worktree /foresight-regional-meta)" -ForegroundColor Magenta
}
Write-Host "==================================================================" -ForegroundColor Green
