@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
set "XIAOZHI_MODE=daily"
set "XIAOZHI_EXIT=1"

if "%~1"=="" goto :check_project
if not "%~2"=="" goto :invalid_option
if /i "%~1"=="--help" goto :help
set "XIAOZHI_MODE="
if /i "%~1"=="--check" set "XIAOZHI_MODE=check"
if /i "%~1"=="--knowledge-preview" set "XIAOZHI_MODE=preview"
if not defined XIAOZHI_MODE goto :invalid_option

:check_project
pushd "%~dp0apps\desktop" || goto :path_error
if not exist "package.json" goto :project_error
if not exist "package-lock.json" goto :project_error
if not exist "scripts\start-desktop.mjs" goto :project_error
where.exe /q node.exe || goto :node_error
where.exe /q npm.cmd || goto :node_error
if not exist "node_modules\.bin\tsc.cmd" goto :dependencies_error
if not exist "node_modules\.bin\electron-vite.cmd" goto :dependencies_error

rem Keep inherited Node hooks out of the launcher. The npm script owns Electron startup.
set "NODE_OPTIONS="
if "%XIAOZHI_MODE%"=="check" goto :check_dependencies

if "%XIAOZHI_MODE%"=="preview" goto :start_preview
title 小智 - 当前源码调试版
echo [小智] 正在构建当前源码。构建成功后打开日常工作台。
call npm.cmd start
goto :start_result

:start_preview
title 小智 - 知识库预览
echo [小智] 正在构建知识库预览。预览使用独立资料目录。
call npm.cmd start -- --knowledge-preview

:start_result
set "XIAOZHI_EXIT=%errorlevel%"
if not "%XIAOZHI_EXIT%"=="0" goto :start_error
popd
exit /b 0

:check_dependencies
node.exe "scripts\start-desktop.mjs" --check
set "XIAOZHI_EXIT=%errorlevel%"
if not "%XIAOZHI_EXIT%"=="0" goto :error_in_project
echo [小智] 桌面项目、Node.js 和 npm 检查通过。
echo [小智] 检查目录 "%CD%"
popd
exit /b 0

:start_error
echo.
echo [小智] 启动失败，退出码 %XIAOZHI_EXIT%。请查看上方错误并重试。
goto :error_in_project

:node_error
echo [小智] 未找到 Node.js 或 npm.cmd。请检查安装和 PATH 后重试。
goto :error_in_project

:dependencies_error
echo [小智] 桌面依赖缺失或版本不匹配。请在下列目录运行 npm.cmd ci 后重试：
echo "%CD%"
goto :error_in_project

:project_error
echo [小智] 桌面项目或启动脚本缺失。请使用完整的 EduDev 工作目录。
goto :error_in_project

:path_error
echo [小智] 找不到 "%~dp0apps\desktop"。请将启动器放在 EduDev 根目录。
goto :fail

:error_in_project
popd
:fail
if not "%XIAOZHI_MODE%"=="check" pause
exit /b %XIAOZHI_EXIT%

:invalid_option
echo [小智] 不支持的参数。
set "XIAOZHI_EXIT=2"
goto :usage

:help
set "XIAOZHI_EXIT=0"
:usage
echo [小智] 双击启动，或从命令行执行：
echo   启动小智.cmd
echo   启动小智.cmd --knowledge-preview
echo   启动小智.cmd --check
exit /b %XIAOZHI_EXIT%
