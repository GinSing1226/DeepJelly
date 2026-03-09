@echo off
cd adapters\openclaw
echo Installing dependencies...
call npm install
echo.
echo Running tests...
call npx vitest run --reporter=verbose 2>&1
