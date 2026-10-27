@echo off
cd /d "%~dp0"
echo GeoCost SC - servidor local sin API key
echo Abre http://127.0.0.1:8888/index.html
where py >nul 2>nul
if not errorlevel 1 (py -3 -m http.server 8888 & exit /b)
where python >nul 2>nul
if not errorlevel 1 (python -m http.server 8888 & exit /b)
echo Instala Python o abre index.html con Live Server de VS Code (puerto 5500).
pause
