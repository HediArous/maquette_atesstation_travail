@echo off
cd /d "%~dp0"
node servir-maquette.mjs --wifi --open
if errorlevel 1 pause
