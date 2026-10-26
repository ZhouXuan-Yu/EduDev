@echo off
setlocal
chcp 65001 >nul
title 小智 - 知识库开发版
pushd "%~dp0apps\desktop" || exit /b 1
echo 正在构建并启动当前工作区的知识库功能，资料保存在独立本机目录。
call npm start -- --knowledge-preview
set "taskExit=%errorlevel%"
popd
if not "%taskExit%"=="0" pause
exit /b %taskExit%
