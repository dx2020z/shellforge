@echo off
setlocal
cd /d "%~dp0.."
node scripts/check-port.mjs
if errorlevel 1 exit /b 2
if not exist "node_modules\next\dist\bin\next" (
  call npm ci
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
echo Open http://localhost:3018 after the Ready message.
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo ShellForge did not start. Review the error above.
pause
exit /b 1
