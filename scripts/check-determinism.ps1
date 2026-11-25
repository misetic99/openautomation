<#
.SYNOPSIS
Exports a project twice and reports byte differences and changed XML paths.
.EXAMPLE
.\scripts\check-determinism.ps1 -ProjectFile C:\work\Demo.ap18 -BridgePath C:\tools\openautomation-bridge.exe
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectFile,
    [string]$BridgePath = 'openautomation-bridge',
    [ValidateRange(17, 99)][int]$Tia = 18,
    [string]$OutputRoot = (Join-Path ([IO.Path]::GetTempPath()) ('oa-determinism-' + [Guid]::NewGuid().ToString('N')))
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FileMap([string]$Root) {
    $map = [Collections.Generic.SortedDictionary[string, string]]::new([StringComparer]::Ordinal)
    foreach ($file in Get-ChildItem -LiteralPath $Root -Recurse -File) {
        $relative = $file.FullName.Substring($Root.Length + 1).Replace('\', '/')
        $map.Add($relative, $file.FullName)
    }
    return ,$map
}

function Get-Hash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)) }
    finally { $stream.Dispose(); $hash.Dispose() }
}

function Get-XmlValues([string]$Path) {
    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create($Path, $settings)
    $document = [Xml.XmlDocument]::new()
    $document.XmlResolver = $null
    try { $document.Load($reader) } finally { $reader.Dispose() }
    $values = [Collections.Generic.SortedDictionary[string, string]]::new([StringComparer]::Ordinal)
    function Visit-Element([Xml.XmlElement]$Element, [string]$Location) {
        $values[$Location] = ''
        foreach ($attribute in $Element.Attributes) {
            $values[$Location + '/@{' + $attribute.NamespaceURI + '}' + $attribute.LocalName] = $attribute.Value
        }
        $counts = [Collections.Generic.Dictionary[string, int]]::new([StringComparer]::Ordinal)
        $text = [Text.StringBuilder]::new()
        foreach ($child in $Element.ChildNodes) {
            if ($child -is [Xml.XmlElement]) {
                $name = '{' + $child.NamespaceURI + '}' + $child.LocalName
                if (-not $counts.ContainsKey($name)) { $counts[$name] = 0 }
                $counts[$name]++
                Visit-Element $child ($Location + '/' + $name + '[' + $counts[$name] + ']')
            } elseif ($child.NodeType -in @([Xml.XmlNodeType]::Text, [Xml.XmlNodeType]::CDATA)) {
                [void]$text.Append($child.Value)
            }
        }
        $values[$Location] = $text.ToString()
    }
    $root = $document.DocumentElement
    Visit-Element $root ('/{' + $root.NamespaceURI + '}' + $root.LocalName + '[1]')
    return ,$values
}

try {
    $project = (Resolve-Path -LiteralPath $ProjectFile).ProviderPath
    if (-not [IO.File]::Exists($project)) { throw 'ProjectFile must be a file.' }
    $bridge = (Get-Command $BridgePath -ErrorAction Stop).Source
    [void](Get-Command git -ErrorAction Stop)
    $root = [IO.Path]::GetFullPath($OutputRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if (Test-Path -LiteralPath $root) { throw 'OutputRoot must not exist; existing exports are never overwritten.' }
    [void][IO.Directory]::CreateDirectory($root)
    $first = Join-Path $root 'first'
    $second = Join-Path $root 'second'
    foreach ($destination in @($first, $second)) {
        # No --upgrade: checking determinism must not migrate the source project.
        & $bridge export $project $destination --tia ([string]$Tia) | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Bridge export failed with exit code $LASTEXITCODE. Results retained in $root" }
        if (-not (Test-Path -LiteralPath (Join-Path $destination 'project.json') -PathType Leaf)) {
            throw 'Bridge returned success without project.json.'
        }
    }
    Write-Output "Exports retained in: $root"
    & git -c core.autocrlf=false diff --no-index --no-ext-diff --no-renames --name-status -- $first $second | Out-Host
    if ($LASTEXITCODE -notin @(0, 1)) { throw "git diff failed with exit code $LASTEXITCODE" }
    $left = Get-FileMap $first
    $right = Get-FileMap $second
    $names = [Collections.Generic.SortedSet[string]]::new([StringComparer]::Ordinal)
    $names.UnionWith($left.Keys)
    $names.UnionWith($right.Keys)
    $different = $false
    foreach ($name in $names) {
        if (-not $left.ContainsKey($name)) { Write-Output "Added: $name"; $different = $true; continue }
        if (-not $right.ContainsKey($name)) { Write-Output "Removed: $name"; $different = $true; continue }
        if ((Get-Hash $left[$name]) -eq (Get-Hash $right[$name])) { continue }
        $different = $true
        Write-Output "Changed: $name"
        if ([IO.Path]::GetExtension($name) -notin @('.xml', '.aml')) { continue }
        try {
            $a = Get-XmlValues $left[$name]
            $b = Get-XmlValues $right[$name]
            $paths = [Collections.Generic.SortedSet[string]]::new([StringComparer]::Ordinal)
            $paths.UnionWith($a.Keys)
            $paths.UnionWith($b.Keys)
            $xmlChanged = $false
            foreach ($path in $paths) {
                if (-not $a.ContainsKey($path) -or -not $b.ContainsKey($path) -or $a[$path] -cne $b[$path]) {
                    Write-Output "  XML: $path"
                    $xmlChanged = $true
                }
            }
            if (-not $xmlChanged) { Write-Output '  XML values match; check formatting, comments, encoding or node order.' }
        } catch { Write-Output '  XML could not be compared; inspect the retained files.' }
    }
    if ($different) { Write-Output 'FAIL: exports differ.'; exit 1 }
    Write-Output 'PASS: exports are byte-identical.'
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 2
}
