@echo off
echo 🔄 Updating Flutter app with current ngrok URL...

REM Get the current ngrok URL
for /f "tokens=2 delims=:" %%i in ('curl -s http://localhost:4040/api/tunnels ^| findstr "public_url.*https"') do (
    set NGROK_URL=%%i
)

REM Clean up the URL (remove quotes and extra characters)
set NGROK_URL=%NGROK_URL:"=%
set NGROK_URL=%NGROK_URL:,=%
set NGROK_URL=https:%NGROK_URL%

echo 📡 Current ngrok URL: %NGROK_URL%

REM Update the config file
powershell -Command "(Get-Content 'lib\config.dart') -replace 'static const String _ngrokBackendUrl = ''.*'';', 'static const String _ngrokBackendUrl = ''%NGROK_URL%'';' | Set-Content 'lib\config.dart'"

echo ✅ Updated config.dart with new ngrok URL
echo 🚀 Now run: flutter run

pause