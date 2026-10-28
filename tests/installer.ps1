# Isolated installer integration test. Never points at the user's real Spotify or Spicetify.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sandbox = Join-Path $projectRoot ('test-results\installer-' + [guid]::NewGuid().ToString('N'))
$fakeBin = Join-Path $sandbox 'bin'
$fakeAppData = Join-Path $sandbox 'AppData'
$fakeConfig = Join-Path $fakeAppData 'spicetify\config-xpui.ini'
$fakeSpotify = Join-Path $fakeAppData 'Spotify\Spotify.exe'
New-Item -ItemType Directory -Path $fakeBin,(Split-Path -Parent $fakeConfig),(Split-Path -Parent $fakeSpotify) -Force | Out-Null
Set-Content -LiteralPath $fakeSpotify -Value 'FAKE TEST FILE - NOT AN EXECUTABLE'
Set-Content -LiteralPath $fakeConfig -Value "[Setting]`nspotify_path = $(Split-Path -Parent $fakeSpotify)`n[AdditionalOptions]`nextensions = another-extension.js"
$mockScript = @'
const fs = require('node:fs');
const path = require('node:path');
const config = path.join(process.env.APPDATA, 'spicetify', 'config-xpui.ini');
const args = process.argv.slice(2);
if (args[0] === '-c') console.log(config);
else if (args[0] === 'config' && args[1] === 'extensions') {
  const text = fs.readFileSync(config, 'utf8');
  const old = text.match(/^extensions\s*=\s*(.*)$/m)?.[1].split('|').filter(Boolean) || [];
  const item = args[2];
  const next = item.endsWith('-') ? old.filter(x => x !== item.slice(0, -1)) : [...new Set([...old, item])];
  fs.writeFileSync(config, text.replace(/^extensions\s*=.*$/m, 'extensions = ' + next.join('|')));
} else throw new Error('Unexpected command in SkipApply test: ' + args.join(' '));
'@
Set-Content -LiteralPath (Join-Path $fakeBin 'mock-spicetify.cjs') -Value $mockScript
$nodeBinary = (Get-Command node -ErrorAction Stop).Source
Set-Content -LiteralPath (Join-Path $fakeBin 'spicetify.cmd') -Value "@echo off`r`n`"$nodeBinary`" `"%~dp0mock-spicetify.cjs`" %*"
$previousPath = $env:PATH
$previousAppData = $env:APPDATA
$previousLocalAppData = $env:LOCALAPPDATA
try {
    $env:PATH = "$fakeBin;$previousPath"
    $env:APPDATA = $fakeAppData
    $env:LOCALAPPDATA = $fakeAppData
    function Get-AppxPackage { param($Name) return $null }
    $installer = Join-Path $projectRoot 'scripts\install.ps1'
    & $installer -SkipApply
    & $installer -SkipApply
    $installed = Join-Path (Split-Path -Parent $fakeConfig) 'Extensions\minisearch.js'
    if (-not (Test-Path -LiteralPath $installed)) { throw 'Extension not copied' }
    if ((Get-FileHash -LiteralPath $installed).Hash -ne (Get-FileHash -LiteralPath (Join-Path $projectRoot 'minisearch.js')).Hash) { throw 'Installed content differs from source' }
    $configText = Get-Content -LiteralPath $fakeConfig -Raw
    if ([regex]::Matches($configText, 'minisearch\.js').Count -ne 1) { throw 'Duplicate registration' }
    if ($configText -notmatch 'another-extension\.js') { throw 'Existing extension lost' }
    & $installer -Uninstall -SkipApply
    if (Test-Path -LiteralPath $installed) { throw 'Extension file was not removed' }
    if ((Get-Content -LiteralPath $fakeConfig -Raw) -notmatch 'another-extension\.js') { throw 'Uninstall changed other extensions' }
    $storeConfig = "[Setting]`nspotify_path = C:\Program Files\WindowsApps\Spotify`n[AdditionalOptions]`nextensions = another-extension.js"
    Set-Content -LiteralPath $fakeConfig -Value $storeConfig
    Remove-Item -LiteralPath $fakeSpotify
    $blocked = $false
    try { & $installer -SkipApply } catch { $blocked = $_.Exception.Message -match 'Spotify installation could not be found' }
    if (-not $blocked) { throw 'Unsupported Store installation was not blocked' }
    if ((Get-Content -LiteralPath $fakeConfig -Raw) -match 'minisearch\.js') { throw 'Unsupported installation changed config' }
    Write-Output 'PASS: install, update, deduplication, file integrity, other-extension preservation, uninstall and unsupported-install guard.'
} finally {
    $env:PATH = $previousPath
    $env:APPDATA = $previousAppData
    $env:LOCALAPPDATA = $previousLocalAppData
}
