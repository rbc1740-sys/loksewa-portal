$ErrorActionPreference = "Stop"
function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    # \w keeps Unicode letters (including Devanagari) and digits
    $t = $s.ToLower() -replace '[^\w]+', ' '
    return $t.Trim()
}

function Flatten($items) {
    if ($items -is [System.Collections.IEnumerable] -and -not ($items -is [string]) -and -not ($items -is [pscustomobject])) {
        foreach ($i in $items) { Flatten $i }
    } elseif ($null -ne $items) {
        $items
    }
}

$files = Get-ChildItem "questions\*.json"
$seen = @{}
$dups = 0
$total = 0
foreach ($f in $files) {
    try {
        $data = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Output "SKIP $($f.Name): $($_.Exception.Message)"
        continue
    }
    foreach ($q in (Flatten $data)) {
        if ($q -isnot [pscustomobject]) { continue }
        $total++
        $sig = Normalize $q.question
        $opts = @()
        if ($q.options) {
            $q.options.PSObject.Properties | ForEach-Object {
                $v = Normalize $_.Value
                if ($v) { $opts += $v }
            }
        }
        $sig = "$sig`::$(($opts | Sort-Object) -join '|')"
        if ([string]::IsNullOrWhiteSpace($sig)) { continue }
        if ($seen.ContainsKey($sig)) {
            $dups++
            Write-Output "DUP: $($sig.Substring(0, [Math]::Min(80, $sig.Length)))"
            Write-Output "   first in: $($seen[$sig])  dup in: $($f.Name)"
        } else {
            $seen[$sig] = $f.Name
        }
    }
}
Write-Output "Total question objects: $total"
Write-Output "Duplicate question texts: $dups"