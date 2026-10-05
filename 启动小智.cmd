@echo off
cd /d "%~dp0apps\desktop"
call npm start
if errorlevel 1 pause
