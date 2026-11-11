@echo off
title Chomp installed app signing
powershell.exe -NoProfile -File "%~dp0Sign-Locally.ps1" -Installed
echo.
pause
