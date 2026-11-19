@echo off
REM Catalistics - deploy to Firebase. Double-click this file to run it.
REM The project ID is set here, so this works even if .firebaserc is missing
REM (GitHub's drag-and-drop upload leaves out files that start with a dot).
setlocal
set PROJECT=metering-1-22462
cd /d "%~dp0"
title Catalistics deploy - %PROJECT%

where firebase >nul 2>nul
if errorlevel 1 (
  echo.
  echo The Firebase tool is not installed yet. Install Node.js from nodejs.org, then run:
  echo     npm install -g firebase-tools
  echo     firebase login
  echo and double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Catalistics deploy  -  project %PROJECT%
echo   ------------------------------------------------------------
echo   1  Website + database rules          (start here)
echo   2  Portal Documents storage rules    (only if Storage is switched on)
echo   3  Set or change the Claude API key  (for Catalistics AI)
echo   4  Catalistics AI function           (needs Blaze plan + API key)
echo   5  Everything above
echo   6  Sign in to Firebase again
echo.
choice /c 123456 /n /m "  Choose 1-6: "
set PICK=%errorlevel%
echo.
if %PICK%==1 goto web
if %PICK%==2 goto storage
if %PICK%==3 goto key
if %PICK%==4 goto ai
if %PICK%==5 goto all
if %PICK%==6 goto login
goto end

:web
call firebase deploy --only hosting,firestore --project %PROJECT%
goto end

:storage
call firebase deploy --only storage --project %PROJECT%
goto end

:key
echo Paste your Claude API key when asked. Nothing shows while you paste - that is normal.
call firebase functions:secrets:set ANTHROPIC_API_KEY --project %PROJECT%
goto end

:ai
pushd functions
call npm install
popd
call firebase deploy --only functions --project %PROJECT%
goto end

:all
pushd functions
call npm install
popd
call firebase deploy --project %PROJECT%
goto end

:login
call firebase login --reauth
goto end

:end
echo.
echo Finished. If you see "Deploy complete!" above, it worked.
echo Website: https://%PROJECT%.web.app
echo.
pause
