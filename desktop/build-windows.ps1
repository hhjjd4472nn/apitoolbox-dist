$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "[1/4] Node and npm"
node --version
npm --version

Write-Host "[2/4] Install dependencies"
npm install

Write-Host "[3/4] Check and tests"
npm run check
npm test

Write-Host "[4/4] Build Windows x64 portable and NSIS"
npm run dist

$portable = Get-ChildItem -Path (Join-Path $Root 'dist') -Filter '*portable*.exe' -ErrorAction SilentlyContinue
$setup = Get-ChildItem -Path (Join-Path $Root 'dist') -Filter '*setup*.exe' -ErrorAction SilentlyContinue
if (-not $portable) { throw 'portable exe not found in dist/' }
if (-not $setup) { throw 'NSIS setup exe not found in dist/' }

Write-Host "Build complete"
$portable | Select-Object FullName,Length
$setup | Select-Object FullName,Length
Get-FileHash $portable.FullName -Algorithm SHA256
Get-FileHash $setup.FullName -Algorithm SHA256