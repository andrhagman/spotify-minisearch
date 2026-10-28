# Launch the Microsoft Store Spotify client with MiniSearch's writable UI assets.
$ErrorActionPreference = 'Stop'
$launcherRoot = Join-Path $env:LOCALAPPDATA 'SpotifyMiniSearch'
$logFile = Join-Path $launcherRoot 'launcher.log'
try {
    $package = Get-AppxPackage -Name SpotifyAB.SpotifyMusic | Select-Object -First 1
    if (-not $package) { throw 'Microsoft Store Spotify was not found.' }
    $containerRoot = Join-Path $env:LOCALAPPDATA ('Packages\' + $package.PackageFamilyName + '\LocalState')
    $appsPath = Join-Path $containerRoot 'MiniSearchApps'
    $versionFile = Join-Path $launcherRoot 'store-version.txt'
    $lastVersion = if (Test-Path -LiteralPath $versionFile) { (Get-Content -LiteralPath $versionFile -Raw).Trim() } else { '' }
    if ($lastVersion -ne [string]$package.Version -or -not (Test-Path -LiteralPath (Join-Path $appsPath 'xpui\index.html'))) {
        $cli = Get-Command spicetify -ErrorAction SilentlyContinue
        if (-not $cli) { $cli = Get-Command (Join-Path $env:LOCALAPPDATA 'spicetify\spicetify.exe') -ErrorAction Stop }
        $prefsPath = Join-Path $containerRoot 'Spotify\prefs'
        & $cli.Source config spotify_path $package.InstallLocation prefs_path $prefsPath *> $logFile
        if ($LASTEXITCODE -ne 0) { throw 'Could not update Spicetify paths after a Spotify update.' }
        'y' | & $cli.Source -n -q backup apply *>> $logFile
        if ($LASTEXITCODE -ne 0) { throw 'Could not rebuild MiniSearch after a Spotify update. See launcher.log.' }
        $configPath = (& $cli.Source -c | Select-Object -Last 1).Trim()
        $sourceApps = Join-Path (Split-Path -Parent $configPath) 'AppX'
        New-Item -ItemType Directory -Path $appsPath -Force | Out-Null
        foreach ($app in @('xpui', 'login')) {
            Copy-Item -LiteralPath (Join-Path $sourceApps $app) -Destination $appsPath -Recurse -Force
        }
        $extensionPath = Join-Path $appsPath 'xpui\extensions\minisearch.js'
        $versionMatch = [regex]::Match((Get-Content -LiteralPath $extensionPath -TotalCount 1), 'MiniSearch v([0-9.]+)')
        if ($versionMatch.Success) {
            $indexPath = Join-Path $appsPath 'xpui\index.html'
            $indexHTML = Get-Content -LiteralPath $indexPath -Raw
            $indexHTML = [regex]::Replace($indexHTML, 'extensions/minisearch\.js(?:\?[^''"]*)?', ('extensions/minisearch.js?v=' + $versionMatch.Groups[1].Value))
            [System.IO.File]::WriteAllText($indexPath, $indexHTML)
        }
        Set-Content -LiteralPath $versionFile -Value ([string]$package.Version)
    }
    # An existing unmodified Spotify process ignores the new app-directory argument.
    $mainProcesses = Get-CimInstance Win32_Process -Filter "Name='Spotify.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' }
    $alreadyPatched = @($mainProcesses | Where-Object { $_.CommandLine -match [regex]::Escape($appsPath) }).Count -gt 0
    if ($mainProcesses -and -not $alreadyPatched) { Get-Process Spotify -ErrorAction SilentlyContinue | Stop-Process }
    $aliasPath = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\Spotify.exe'
    Start-Process -FilePath $aliasPath -ArgumentList ('--app-directory="' + $appsPath + '"') -WindowStyle Normal
} catch {
    New-Item -ItemType Directory -Path $launcherRoot -Force | Out-Null
    ('MiniSearch: ' + $_.Exception.Message) | Add-Content -LiteralPath $logFile
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show("MiniSearch could not start Spotify.`n$($_.Exception.Message)`n`nLog: $logFile", 'Spotify MiniSearch') | Out-Null
}
