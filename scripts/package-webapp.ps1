$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Version = (Get-Content -LiteralPath (Join-Path $Root 'VERSION') -Raw).Trim()
$Dist = Join-Path $Root 'dist'
$Stage = Join-Path $Dist "money-meva-webapp-$Version"
$Zip = Join-Path $Dist "money-meva-webapp-$Version.zip"

Push-Location $Root
try {
  npm run build
} finally {
  Pop-Location
}

if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
if (Test-Path -LiteralPath $Zip) { Remove-Item -LiteralPath $Zip -Force }
New-Item -ItemType Directory -Path $Stage | Out-Null

Copy-Item -Path (Join-Path $Root '.next\standalone\*') -Destination $Stage -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $Stage '.next') -Force | Out-Null
Copy-Item -Path (Join-Path $Root '.next\static') -Destination (Join-Path $Stage '.next\static') -Recurse -Force
Copy-Item -Path (Join-Path $Root 'public') -Destination (Join-Path $Stage 'public') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $Root 'VERSION') -Destination (Join-Path $Stage 'VERSION') -Force

@"
Money Meva Web App $Version

Requirements:
- Node.js 20 or newer

Run:
1. Extract this zip.
2. Open a terminal in the extracted folder.
3. Run: node server.js
4. Open: http://localhost:3000

Share data between users/devices:
- In Money Meva, go to Settings > Export JSON.
- On the other device/browser, go to Settings > Import JSON.

Notes:
- App data is stored in each browser's local storage.
- This package contains the web app runtime, not private browser data.
"@ | Set-Content -LiteralPath (Join-Path $Stage 'README-RUN.txt') -Encoding UTF8

Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -Force
"Created $Zip"
