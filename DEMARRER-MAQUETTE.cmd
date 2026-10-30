@echo off
cd /d "%~dp0"
node servir-maquette.mjs --open
if errorlevel 1 pause
