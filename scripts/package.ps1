$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$buildPath = Join-Path $projectPath 'dist'
$artifactPath = Join-Path $projectPath 'artifacts'
if (-not (Test-Path -LiteralPath (Join-Path $buildPath 'index.html'))) { throw 'Run npm run build first.' }
New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
$releasePath = $artifactPath
New-Item -ItemType Directory -Path $releasePath -Force | Out-Null
$archivePath = Join-Path $artifactPath 'brawl-click-yandex.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Get-Sha256([string] $Path) {
  $hashStream = [System.IO.File]::OpenRead($Path)
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($hasher.ComputeHash($hashStream)).Replace('-', '') }
  finally { $hashStream.Dispose(); $hasher.Dispose() }
}
$files = @(Get-ChildItem -LiteralPath $buildPath -File -Recurse | Where-Object {
  $relative = $_.FullName.Substring($buildPath.Length + 1).Replace('\', '/')
  $relative -eq 'index.html' -or $relative.StartsWith('assets/') -or $relative.StartsWith('art/') -or $relative.StartsWith('brawlers/') -or $relative.StartsWith('icons/') -or $relative.StartsWith('audio/')
})
$bytes = ($files | Measure-Object -Property Length -Sum).Sum
if ($bytes -gt 100MB) { throw 'Unpacked game exceeds 100 MiB.' }
foreach ($file in $files) {
  $relative = $file.FullName.Substring($buildPath.Length + 1).Replace('\', '/')
  if ($relative -notmatch '^[a-zA-Z0-9_./-]+$') { throw "Invalid archive filename: $relative" }
}
# Create a complete temporary archive before replacing the previous release.
$temporary = Join-Path $artifactPath ('brawl-build-' + [guid]::NewGuid().ToString('N') + '.zip')
$archive = [System.IO.Compression.ZipFile]::Open($temporary, 'Create')
try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($buildPath.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, 'Optimal') | Out-Null
  }
} finally { $archive.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($temporary)
try {
  if (@($check.Entries | Where-Object FullName -eq 'index.html').Count -ne 1) { throw 'Missing root index.html.' }
  if ($check.Entries.Count -ne $files.Count) { throw 'Archive file count mismatch.' }
  foreach ($entry in $check.Entries) {
    if ($entry.FullName.Contains('..') -or $entry.FullName.StartsWith('/')) { throw 'Unsafe ZIP entry.' }
    $source = Get-Item -LiteralPath (Join-Path $buildPath $entry.FullName)
    $stream = $entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -ne (Get-Sha256 $source.FullName)) { throw "Corrupt entry: $($entry.FullName)" }
  }
} finally { $check.Dispose() }
Move-Item -LiteralPath $temporary -Destination $archivePath -Force
$manifest = [ordered]@{
  game = 'brawl-click'; version = (Get-Content -LiteralPath (Join-Path $projectPath 'package.json') -Raw | ConvertFrom-Json).version
  builtAt = [DateTime]::UtcNow.ToString('o'); archive = 'brawl-click-yandex.zip'
  sha256 = Get-Sha256 $archivePath
  compressedBytes = (Get-Item -LiteralPath $archivePath).Length; unpackedBytes = $bytes; fileCount = $files.Count
  files = @($files | ForEach-Object { [ordered]@{ path = $_.FullName.Substring($buildPath.Length + 1).Replace('\', '/'); bytes = $_.Length; sha256 = Get-Sha256 $_.FullName } })
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $releasePath 'build-manifest.json') -Encoding UTF8
Write-Output "Yandex upload candidate: $archivePath"
Write-Output "Verified $($files.Count) files, $bytes unpacked bytes. Not uploaded or published."
