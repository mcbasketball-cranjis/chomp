@echo off
title Chomp local signing
powershell.exe -NoProfile -File "%~dp0Sign-Locally.ps1"
echo.
pause
