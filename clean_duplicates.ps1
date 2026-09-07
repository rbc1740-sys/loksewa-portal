$ErrorActionPreference = "Stop"

function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    $t = $s.ToLower() -replace '[^a-z0-9]+', ' '
    return $t.Trim()
}

function Get-Signature($q) {
    $question = Normalize $q.question
    $options = @()
    if ($q.options) {
        $q.options.PSObject.Properties | ForEach-Object {
            $v = Normalize $_.Value
            if ($v) { $options += $v }
        }
    }
    $sorted = ($options | Sort-Object) -join "|"
    if (-not $question -and -not $sorted) { return $null }
    return "$question`::$sorted"
}

function Flatten($items) {
    if ($items -is [System.Collections.IEnumerable] -and -not ($items -is [string]) -and -not ($items -is [pscustomobject])) {
        foreach ($i in $items) { Flatten $i }
    } elseif ($null -ne $items) {
        $items
    }
}

$files = Get-ChildItem "questions\*.json" | Sort-Object Name
$globalSeen = @{}
$totalRemoved = 0

foreach ($f in $files) {
    try {
        $data = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Output "SKIP $($f.Name): $($_.Exception.Message)"
        continue
    }

    $kept = New-Object System.Collections.Generic.List[object]
    $removedInFile = 0

    foreach ($q in (Flatten $data)) {
        if ($q -isnot [pscustomobject]) { continue }
        $sig = Get-Signature $q
        if ($null -eq $sig) {
            $kept.Add($q)
            continue
        }
        if ($globalSeen.ContainsKey($sig)) {
            $removedInFile++
            continue
        }
        $globalSeen[$sig] = $f.Name
        $kept.Add($q)
    }

    if ($removedInFile -gt 0) {
        # Write back as a clean JSON array (UTF-8)
        $json = $kept | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($f.FullName, $json, (New-Object System.Text.UTF8Encoding($false)))
        Write-Output "$($f.Name): removed $removedInFile duplicates, kept $($kept.Count)"
        $totalRemoved += $removedInFile
    } else {
        Write-Output "$($f.Name): no duplicates removed ($($kept.Count) questions)"
    }
}

Write-Output "TOTAL duplicates removed: $totalRemoved"