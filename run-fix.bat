@echo off
echo Fixing OneDrive sync issues...
echo.

REM Delete .next folder first
if exist .next (
    echo Deleting .next folder...
    rmdir /s /q .next
    echo Done!
    echo.
)

REM Exclude folders from OneDrive
echo Excluding build folders from OneDrive sync...

if exist .next (
    attrib +U .next /S /D
    echo   [OK] .next excluded
)

if exist node_modules (
    attrib +U node_modules /S /D
    echo   [OK] node_modules excluded
)

if exist api\node_modules (
    attrib +U api\node_modules /S /D
    echo   [OK] api\node_modules excluded
)

if exist api\dist (
    attrib +U api\dist /S /D
    echo   [OK] api\dist excluded
)

if exist api\data (
    attrib +U api\data /S /D
    echo   [OK] api\data excluded
)

echo.
echo All done! Build folders are now excluded from OneDrive.
echo You can now run: npm run dev:all
echo.
pause
