# Codex of Verra: copy skill tree textures out of the game's own pakchunk0_s2 container.
# The container in this build is not encrypted or compressed, so this only reads
# byte ranges listed in icon_list.tsv. Nothing in the game folder is changed.
# Output: parts_ui\ui_001.zip, ui_002.zip ... (about 4.5 MB each) next to this script.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ucas = 'D:\SteamLibrary\steamapps\common\Ashes of Creation\Game\AOC\Content\Paks\pakchunk0_s2-WindowsClient.ucas'
$list = Join-Path $here 'ui_list.tsv'
$outDir = Join-Path $here 'parts_ui'
$limit = 4500000

if (-not (Test-Path -LiteralPath $ucas)) {
    Write-Host "Game file not found: $ucas"
    exit 1
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $outDir) { Get-ChildItem -LiteralPath $outDir -Filter 'ui_*.zip' | Remove-Item -Force }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$lines = @(Get-Content -LiteralPath $list | Where-Object { $_ -ne '' })
$src = [System.IO.File]::OpenRead($ucas)
$script:part = 0
$script:zipFs = $null
$script:zip = $null

function Close-Part {
    if ($script:zip -ne $null) { $script:zip.Dispose(); $script:zip = $null }
    if ($script:zipFs -ne $null) { $script:zipFs.Dispose(); $script:zipFs = $null }
}
function Open-Part {
    Close-Part
    $script:part++
    $path = Join-Path $outDir ('ui_{0:D3}.zip' -f $script:part)
    $script:zipFs = [System.IO.File]::Create($path)
    $script:zip = New-Object System.IO.Compression.ZipArchive($script:zipFs, [System.IO.Compression.ZipArchiveMode]::Create, $true)
}

$done = 0
try {
    foreach ($line in $lines) {
        $f = $line.Split("`t")
        $ms = New-Object System.IO.MemoryStream
        for ($k = 1; $k -lt $f.Length; $k += 2) {
            $off = [int64]$f[$k]
            $len = [int]$f[$k + 1]
            $buf = New-Object byte[] $len
            [void]$src.Seek($off, [System.IO.SeekOrigin]::Begin)
            $read = 0
            while ($read -lt $len) {
                $n = $src.Read($buf, $read, $len - $read)
                if ($n -le 0) { throw "Unexpected end of game file at $off" }
                $read += $n
            }
            $ms.Write($buf, 0, $len)
        }
        if ($script:zip -eq $null -or $script:zipFs.Length -gt $limit) { Open-Part }
        $entry = $script:zip.CreateEntry($f[0], [System.IO.Compression.CompressionLevel]::Optimal)
        $es = $entry.Open()
        $ms.Position = 0
        $ms.CopyTo($es)
        $es.Dispose()
        $ms.Dispose()
        $done++
        if ($done % 250 -eq 0) { Write-Host ("{0} / {1} textures" -f $done, $lines.Count) }
    }
}
finally {
    Close-Part
    $src.Dispose()
}
Write-Host ''
Write-Host ("Done: {0} textures in {1} parts, folder: {2}" -f $done, $script:part, $outDir)
