@echo off
echo ========================================
echo Safari Ops Mobile - Cache Cleaner
echo ========================================
echo.

echo [1/6] Clearing Metro bundler cache...
call npx react-native start --reset-cache >nul 2>&1
timeout /t 2 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1

echo [2/6] Clearing node_modules cache...
if exist "node_modules\.cache" (
    rd /s /q "node_modules\.cache"
    echo     - Cleared node_modules\.cache
) else (
    echo     - node_modules\.cache not found
)

echo [3/6] Clearing .expo cache...
if exist ".expo" (
    rd /s /q ".expo"
    echo     - Cleared .expo
) else (
    echo     - .expo not found
)

echo [4/6] Clearing Metro temp files...
if exist "%TEMP%\metro-*" (
    rd /s /q "%TEMP%\metro-*" >nul 2>&1
    echo     - Cleared Metro temp files
) else (
    echo     - No Metro temp files found
)

if exist "%TEMP%\haste-map-*" (
    rd /s /q "%TEMP%\haste-map-*" >nul 2>&1
    echo     - Cleared Haste map cache
) else (
    echo     - No Haste map cache found
)

echo [5/6] Verifying npm cache...
call npm cache verify >nul 2>&1
echo     - NPM cache verified

echo [6/6] Clearing Watchman (if installed)...
call watchman watch-del-all >nul 2>&1
if %errorlevel% == 0 (
    echo     - Watchman cache cleared
) else (
    echo     - Watchman not installed (optional)
)

echo.
echo ========================================
echo Cache cleared successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Run: npm start
echo 2. Or:  npx expo start
echo 3. Reload your app (Cmd+R or shake device)
echo.
pause
