# Dependency-free integration checks; no engineering software is needed.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('oa-script-test-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($testRoot)
$project = Join-Path $testRoot 'Example.ap18'
[IO.File]::WriteAllText($project, 'synthetic')
$mock = Join-Path $testRoot 'mock-bridge.ps1'
[IO.File]::WriteAllText($mock, @'
param($Command, $Project, $Destination, $Option, $Version)
if ($env:OA_TEST_MODE -eq 'failure') { exit 7 }
[void][IO.Directory]::CreateDirectory($Destination)
[IO.File]::WriteAllText((Join-Path $Destination 'project.json'), '{}')
$value = if ($env:OA_TEST_MODE -eq 'changed' -and $Destination.EndsWith('second')) { '2' } else { '1' }
[IO.File]::WriteAllText((Join-Path $Destination 'sample.xml'), ('<Root><Modified value="' + $value + '">' + $value + '</Modified></Root>'))
if ($env:OA_TEST_MODE -eq 'changed' -and $Destination.EndsWith('second')) {
    [IO.File]::WriteAllText((Join-Path $Destination 'added.txt'), 'new')
}
exit 0
'@)
$script = Join-Path $PSScriptRoot 'check-determinism.ps1'
$shell = (Get-Process -Id $PID).Path
$previousMode = $env:OA_TEST_MODE
$count = 0
try {
    foreach ($mode in @('equal', 'changed', 'failure')) {
        $env:OA_TEST_MODE = $mode
        $destination = Join-Path $testRoot $mode
        $ErrorActionPreference = 'Continue'
        $output = & $shell -NoProfile -ExecutionPolicy Bypass -File $script -ProjectFile $project -BridgePath $mock -OutputRoot $destination 2>&1
        $ErrorActionPreference = 'Stop'
        $expected = @{ equal = 0; changed = 1; failure = 2 }[$mode]
        if ($LASTEXITCODE -ne $expected) { throw "$mode returned $LASTEXITCODE instead of ${expected}: $output" }
        if ($mode -eq 'changed' -and (($output -join "`n") -notmatch 'XML: /\{\}Root\[1\]/\{\}Modified\[1\]/@\{\}value')) {
            throw "Missing changed XML attribute: $output"
        }
        if ($mode -eq 'equal' -and (($output -join "`n") -notmatch 'PASS:')) { throw "Missing success message: $output" }
        $count++
    }
    $ErrorActionPreference = 'Continue'
    $output = & $shell -NoProfile -ExecutionPolicy Bypass -File $script -ProjectFile $project -BridgePath $mock -OutputRoot $testRoot 2>&1
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 2) { throw 'Existing output directory was not refused.' }
    $count++
    Write-Output "Passed: $count script checks."
} finally {
    $env:OA_TEST_MODE = $previousMode
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Test cleanup escaped the temporary directory.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
