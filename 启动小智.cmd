@echo off
setlocal
chcp 65001 >nul
title 小智 - 当前源码调试版
pushd "%~dp0apps\desktop" || goto :path_error
echo [小智] 正在构建当前源码并启动新版桌面工作台…
echo [小智] 首次构建需要一些时间，请等待。构建失败不会打开旧版。
where node >nul 2>nul
if errorlevel 1 goto :node_error
where npm >nul 2>nul
if errorlevel 1 goto :node_error
if not exist "node_modules\electron\dist\electron.exe" goto :dependencies_error
call npm start
set "XIAOZHI_START_EXIT=%errorlevel%"
if not "%XIAOZHI_START_EXIT%"=="0" goto :start_error
popd
exit /b 0

:start_error
echo.
echo [小智] 启动失败。请保留上方错误，修复后重新双击本文件。
popd
pause
exit /b %XIAOZHI_START_EXIT%

:node_error
echo [小智] 未找到 Node.js 或 npm。请安装 Node.js 并重新打开启动器。
popd
pause
exit /b 1

:dependencies_error
echo [小智] 桌面依赖尚未安装。请在以下目录执行 npm ci，然后重新启动：
echo %CD%
popd
pause
exit /b 1

:path_error
echo [小智] 未找到项目的 apps\desktop 目录，请在项目根目录运行本文件。
pause
exit /b 1
