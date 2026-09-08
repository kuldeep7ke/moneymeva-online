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

# Static export (next.config.ts uses output:'export', so `out/` is the artifact — there is no .next/standalone).
Copy-Item -Path (Join-Path $Root 'out\*') -Destination $Stage -Recurse -Force

@"
Money Meva Web App $Version

Requirements:
- Node.js 20 or newer (only needed to serve the static files)

Serve these files from any static host, e.g. in this folder run:
  npx serve out
or
  python -m http.server 3000
then open: http://localhost:3000

Share data between users/devices:
- In Money Meva, go to Settings > Export JSON.
- On the other device/browser, go to Settings > Import JSON.

Notes:
- App data is stored in each browser's local storage/IndexedDB.
- This package contains the static web app, not private browser data.
"@ | Set-Content -LiteralPath (Join-Path $Stage 'README-RUN.txt') -Encoding UTF8

Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -Force
"Created $Zip"
