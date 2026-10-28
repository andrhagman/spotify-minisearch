# MiniSearch v0.3.6 - run from a normal (non-administrator) PowerShell session.
[CmdletBinding()]
param([switch]$Uninstall, [switch]$SkipApply, [switch]$NoShortcut)

$ErrorActionPreference = 'Stop'
$extensionName = 'minisearch.js'
$releaseVersion = 'v0.3.6'
$cli = Get-Command spicetify -ErrorAction SilentlyContinue
if (-not $cli) {
    $knownCLI = Join-Path $env:LOCALAPPDATA 'spicetify\spicetify.exe'
    if (Test-Path -LiteralPath $knownCLI) { $cli = Get-Command $knownCLI }
}
if (-not $cli) {
    throw 'Install Spicetify first: https://spicetify.app/docs/getting-started . Then reopen PowerShell and rerun this script.'
}

function Invoke-Spicetify {
    param([string[]]$Arguments)
    & $cli.Source @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Spicetify command failed: $($Arguments -join ' ')" }
}

$configOutput = & $cli.Source -c
if ($LASTEXITCODE -ne 0) { throw 'Could not locate the Spicetify configuration. Run spicetify once, then retry.' }
$configPath = ($configOutput | Select-Object -Last 1).Trim()
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'Spicetify configuration does not exist. Run spicetify once first.' }
$extensionsPath = Join-Path (Split-Path -Parent $configPath) 'Extensions'
$destination = Join-Path $extensionsPath $extensionName

if ($Uninstall) {
    Invoke-Spicetify -Arguments @('config', 'extensions', "$extensionName-")
    # Remove only this extension's exact file, never any other extensions or settings.
    if (Test-Path -LiteralPath $destination -PathType Leaf) { Remove-Item -LiteralPath $destination }
    if (-not $SkipApply) {
        Invoke-Spicetify -Arguments @('-n', 'apply')
        $installedConfig = Get-Content -LiteralPath $configPath -Raw
        if ($installedConfig -match 'SpotifyAB\.SpotifyMusic') {
            $package = Get-AppxPackage -Name SpotifyAB.SpotifyMusic -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($package) {
                $appsPath = Join-Path $env:LOCALAPPDATA ('Packages\' + $package.PackageFamilyName + '\LocalState\MiniSearchApps')
                if (Test-Path -LiteralPath $appsPath) {
                    foreach ($app in @('xpui', 'login')) { Copy-Item -LiteralPath (Join-Path (Split-Path -Parent $configPath) "AppX\$app") -Destination $appsPath -Recurse -Force }
                }
            }
        }
        $launcherRoot = Join-Path $env:LOCALAPPDATA 'SpotifyMiniSearch'
        $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Spotify MiniSearch.lnk'
        if ((-not $NoShortcut) -and (Test-Path -LiteralPath $shortcutPath)) {
            $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
            if ($shortcut.Arguments -eq ('"' + (Join-Path $launcherRoot 'launch-store.vbs') + '"') -or $shortcut.Arguments.Contains((Join-Path $launcherRoot 'launch-store.ps1'))) { Remove-Item -LiteralPath $shortcutPath }
        }
    }
    Write-Output 'MiniSearch removed. Other extensions and settings were preserved.'
    Write-Output 'Close Spotify and reopen it from its original shortcut.'
    return
}

# Store support uses writable assets inside the package's own LocalState directory.
$regularSpotify = Join-Path $env:APPDATA 'Spotify\Spotify.exe'
$configText = Get-Content -LiteralPath $configPath -Raw
$configuredStandard = $configText -match '(?m)^spotify_path\s*=\s*(.+)$' -and
    $matches[1].Trim() -notmatch 'WindowsApps' -and
    (Test-Path -LiteralPath (Join-Path $matches[1].Trim() 'Spotify.exe'))
$storePackage = $null
if ($configText -match 'SpotifyAB\.SpotifyMusic' -or (-not (Test-Path -LiteralPath $regularSpotify) -and -not $configuredStandard)) {
    $storePackage = Get-AppxPackage -Name SpotifyAB.SpotifyMusic -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not (Test-Path -LiteralPath $regularSpotify) -and -not $configuredStandard -and -not $storePackage) {
    throw 'Spotify installation could not be found. Install Spotify desktop or its Microsoft Store edition, sign in, then rerun this installer.'
}

New-Item -ItemType Directory -Path $extensionsPath -Force | Out-Null
$localCandidates = @((Join-Path $PSScriptRoot $extensionName), (Join-Path (Split-Path -Parent $PSScriptRoot) $extensionName))
$localFile = $localCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
$tempFile = Join-Path $extensionsPath ('minisearch-' + [guid]::NewGuid().ToString('N') + '.tmp')
try {
    if ($localFile) { Copy-Item -LiteralPath $localFile -Destination $tempFile }
    else {
        $releaseURL = "https://github.com/andrhagman/spotify-minisearch/releases/download/$releaseVersion/minisearch.js"
        Invoke-WebRequest -UseBasicParsing -Uri $releaseURL -OutFile $tempFile
    }
    $content = Get-Content -LiteralPath $tempFile -Raw
    if ($content -notmatch 'MiniSearch v0\.3\.6' -or $content -notmatch 'documentPictureInPicture') {
        throw 'Downloaded file did not look like the expected MiniSearch release.'
    }
    if (Test-Path -LiteralPath $destination) { Copy-Item -LiteralPath $destination -Destination "$destination.previous" -Force }
    Move-Item -LiteralPath $tempFile -Destination $destination -Force
} finally {
    if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile }
}

# Spicetify's config command appends and deduplicates extension names.
Invoke-Spicetify -Arguments @('config', 'extensions', $extensionName)
if ($storePackage -and -not $SkipApply) {
    $containerRoot = Join-Path $env:LOCALAPPDATA ('Packages\' + $storePackage.PackageFamilyName + '\LocalState')
    $appsPath = Join-Path $containerRoot 'MiniSearchApps'
    $prefsPath = Join-Path $containerRoot 'Spotify\prefs'
    if (-not (Test-Path -LiteralPath $prefsPath)) { throw 'Open Microsoft Store Spotify, sign in and play a song before installing MiniSearch.' }
    Invoke-Spicetify -Arguments @('config', 'spotify_path', $storePackage.InstallLocation, 'prefs_path', $prefsPath)
    'y' | & $cli.Source -n backup apply
    if ($LASTEXITCODE -ne 0) { throw 'Spicetify could not prepare the Store client.' }
    $sourceApps = Join-Path (Split-Path -Parent $configPath) 'AppX'
    New-Item -ItemType Directory -Path $appsPath -Force | Out-Null
    foreach ($app in @('xpui', 'login')) {
        Copy-Item -LiteralPath (Join-Path $sourceApps $app) -Destination $appsPath -Recurse -Force
    }
    $indexPath = Join-Path $appsPath 'xpui\index.html'
    $indexHTML = Get-Content -LiteralPath $indexPath -Raw
    $indexHTML = [regex]::Replace($indexHTML, 'extensions/minisearch\.js(?:\?[^''"]*)?', "extensions/minisearch.js?v=$releaseVersion")
    [System.IO.File]::WriteAllText($indexPath, $indexHTML)
    $launcherRoot = Join-Path $env:LOCALAPPDATA 'SpotifyMiniSearch'
    New-Item -ItemType Directory -Path $launcherRoot -Force | Out-Null
    foreach ($file in @('launch-store.ps1')) {
        $bundled = Join-Path $PSScriptRoot $file
        $installedLauncher = Join-Path $launcherRoot $file
        if (Test-Path -LiteralPath $bundled) { Copy-Item -LiteralPath $bundled -Destination $installedLauncher -Force }
        else { Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/andrhagman/spotify-minisearch/releases/download/$releaseVersion/$file" -OutFile $installedLauncher }
    }
    Set-Content -LiteralPath (Join-Path $launcherRoot 'store-version.txt') -Value ([string]$storePackage.Version)
    if (-not $NoShortcut) {
        $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Spotify MiniSearch.lnk'
        $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
        $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $launcherRoot 'launch-store.ps1') + '"'
        $shortcut.WindowStyle = 7
        $shortcut.WorkingDirectory = $launcherRoot
        $shortcut.IconLocation = (Join-Path $storePackage.InstallLocation 'Spotify.exe') + ',0'
        $shortcut.Description = 'Spotify with the searchable MiniSearch player (Microsoft Store edition)'
        $shortcut.Save()
    }
    Write-Output 'Store edition configured. Use the Spotify MiniSearch desktop shortcut instead of the original Spotify shortcut.'
} elseif (-not $SkipApply) { Invoke-Spicetify -Arguments @('backup', 'apply') }
Write-Output 'MiniSearch installed. Open Spotify and click the MiniSearch magnifying glass near the playback controls, or press Ctrl+Shift+K while Spotify is focused.'
if ($SkipApply) { Write-Output 'Applying was skipped. Run: spicetify backup apply' }
