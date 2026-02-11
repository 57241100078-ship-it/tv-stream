@echo off
echo Iniciando Servidor de TV...
start cmd /k "npm start"
echo.
echo Esperando que el servidor inicie para abrir el tunel...
timeout /t 5
start cmd /k "npx localtunnel --port 3000 --subdomain mitv-online"
echo.
echo ==================================================
echo CANAL DE TV LISTO
echo ==================================================
echo 1. Abre el estudio: http://localhost:3000/broadcaster.html
echo 2. Comparte tu link de localtunnel con tus amigos.
echo ==================================================
pause
