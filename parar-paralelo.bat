@echo off
echo Removendo worktrees das frentes paralelas...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\parar-paralelo.ps1"
pause
