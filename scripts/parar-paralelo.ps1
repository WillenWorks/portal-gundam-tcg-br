# Remove os worktrees das frentes paralelas.
# Feche as abas do Claude Code (Terminal 2 e 3) antes de rodar.
# Commits feitos nas branches sao preservados; apenas o diretorio de trabalho e removido.

$ErrorActionPreference = "Stop"

$root = (Get-Item -Path ".\").FullName
$wtBase = Join-Path (Split-Path $root -Parent) "portal-gundam-tcg-br-worktrees"

$dirs = @(
    (Join-Path $wtBase "simulator-layout")
    (Join-Path $wtBase "simulator-websocket")
)

foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "removendo worktree: $dir" -ForegroundColor Yellow
        git -C $root worktree remove $dir
    } else {
        Write-Host "nao existe: $dir" -ForegroundColor DarkGray
    }
}

git -C $root worktree prune
Write-Host "Concluido." -ForegroundColor Green
git -C $root worktree list
