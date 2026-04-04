@echo off
REM SweetflipsStreamBot Monitoring Script for Windows
REM This script monitors the bot and restarts it if needed

setlocal enabledelayedexpansion

REM Configuration
set BOT_NAME=sweetflips-bot
set LOG_DIR=.\logs
set MAX_RESTARTS=10
set CHECK_INTERVAL=30
set RESTART_DELAY=5

REM Create logs directory if it doesn't exist
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Function to check if bot is running
:check_bot_status
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *bot.js*" 2>NUL | find /I "node.exe" >NUL
if %ERRORLEVEL% EQU 0 (
    exit /b 0
) else (
    exit /b 1
)

REM Function to start the bot
:start_bot
echo [%date% %time%] [INFO] Starting bot...
start /B node bot.js > "%LOG_DIR%\bot.log" 2>&1
echo [%date% %time%] [SUCCESS] Bot started
exit /b 0

REM Function to restart the bot
:restart_bot
echo [%date% %time%] [WARNING] Restarting bot...
taskkill /F /IM node.exe 2>NUL
timeout /t 2 /nobreak >NUL
call :start_bot
echo [%date% %time%] [SUCCESS] Bot restarted
exit /b 0

REM Function to stop the bot
:stop_bot
echo [%date% %time%] [INFO] Stopping bot...
taskkill /F /IM node.exe 2>NUL
echo [%date% %time%] [SUCCESS] Bot stopped
exit /b 0

REM Function to get bot status
:get_bot_status
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *bot.js*" 2>NUL | find /I "node.exe" >NUL
if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] [INFO] Bot is running
) else (
    echo [%date% %time%] [INFO] Bot is not running
)
exit /b 0

REM Main monitoring loop
:monitor_loop
set restart_count=0

echo [%date% %time%] [INFO] Starting bot monitoring...
echo [%date% %time%] [INFO] Check interval: %CHECK_INTERVAL%s
echo [%date% %time%] [INFO] Max restarts: %MAX_RESTARTS%

:monitor_loop_inner
call :check_bot_status
if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] [SUCCESS] Bot is running normally
    set restart_count=0
) else (
    echo [%date% %time%] [ERROR] Bot is not running!

    if !restart_count! LSS %MAX_RESTARTS% (
        set /a restart_count+=1
        echo [%date% %time%] [WARNING] Restart attempt !restart_count!/%MAX_RESTARTS%

        call :restart_bot
        timeout /t %RESTART_DELAY% /nobreak >NUL
    ) else (
        echo [%date% %time%] [ERROR] Maximum restart attempts reached. Stopping monitoring.
        exit /b 1
    )
)

timeout /t %CHECK_INTERVAL% /nobreak >NUL
goto monitor_loop_inner

REM Handle command line arguments
if "%1"=="start" (
    call :start_bot
    goto :eof
)
if "%1"=="stop" (
    call :stop_bot
    goto :eof
)
if "%1"=="restart" (
    call :restart_bot
    goto :eof
)
if "%1"=="status" (
    call :get_bot_status
    goto :eof
)
if "%1"=="monitor" (
    call :monitor_loop
    goto :eof
)
if "%1"=="" (
    call :monitor_loop
    goto :eof
)

echo Usage: %0 {start^|stop^|restart^|status^|monitor}
echo   start   - Start the bot
echo   stop    - Stop the bot
echo   restart - Restart the bot
echo   status  - Show bot status
echo   monitor - Start monitoring loop (default)
exit /b 1
