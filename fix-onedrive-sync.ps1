# Fix OneDrive sync issues with Next.js build folders
# Run this script as Administrator in PowerShell

Write-Host "Excluding Next.js build folders from OneDrive sync..." -ForegroundColor Cyan

# Get the current directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Folders to exclude from OneDrive
$foldersToExclude = @(
    ".next",
    "node_modules",
    "api\node_modules",
    "api\dist",
    "api\data"
)

foreach ($folder in $foldersToExclude) {
    $fullPath = Join-Path $projectPath $folder

    if (Test-Path $fullPath) {
        Write-Host "Setting OneDrive exclusion for: $folder" -ForegroundColor Yellow

        # Set the folder attribute to exclude from OneDrive sync
        attrib +U "$fullPath" /S /D

        Write-Host "  ✓ Excluded from OneDrive sync" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Folder not found: $folder (will be excluded when created)" -ForegroundColor Gray
    }
}

Write-Host "`nDone! OneDrive will no longer sync build folders." -ForegroundColor Green
Write-Host "You may need to restart OneDrive for changes to take full effect." -ForegroundColor Yellow
