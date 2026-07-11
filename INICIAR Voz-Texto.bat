@echo off
title Voz-Texto - Estudio de voz
cd /d "%~dp0"
echo.
echo   Iniciando Voz-Texto...
echo   (Deja esta ventana abierta mientras usas el programa)
echo.
node servidor.mjs
pause
