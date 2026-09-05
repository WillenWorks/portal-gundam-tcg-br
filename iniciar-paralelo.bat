@echo off
echo Iniciando sessoes paralelas do Claude Code...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-paralelo.ps1"
pause
