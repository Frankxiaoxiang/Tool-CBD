@echo off
REM 设置 Flask 开发环境变量
set FLASK_ENV=development

REM 激活虚拟环境（假设路径是 venv\Scriptsctivate）
call venv\Scripts\activate.bat

REM 启动 Flask 项目
python app.py

pause
