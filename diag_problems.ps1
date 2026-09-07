$ErrorActionPreference = "Continue"

Write-Output "=== 1. JSON VALIDITY CHECK ==="
$files = Get-ChildItem "D:\loksewa-portal\questions\*.json"
foreach ($f in $files) {
    try {
        $null = [System.IO.File]::ReadAllText($f.FullName) | ConvertFrom-Json -ErrorAction Stop
        Write-Output ("OK:   " + $f.Name)
    } catch {
        $msg = $_.Exception.Message
        if ($msg.Length -gt 150) { $msg = $msg.Substring(0, 150) }
        Write-Output ("FAIL: " + $f.Name + " -> " + $msg)
    }
}

Write-Output ""
Write-Output "=== 2. DUPLICATE KEY CHECK (per question object) ==="
foreach ($f in $files) {
    if ($f.Name -eq "tmp_fix.json") { continue }
    $text = [System.IO.File]::ReadAllText($f.FullName)
    # Find duplicate keys within any single {...} block using regex on raw text
    $dupCount = 0
    $blocks = [regex]::Matches($text, '\{[^{}]*\}')
    foreach ($b in $blocks) {
        $keys = [regex]::Matches($b.Value, '"([A-Za-z0-9_]+)"\s*:') | ForEach-Object { $_.Groups[1].Value }
        $grouped = $keys | Group-Object | Where-Object { $_.Count -gt 1 }
        if ($grouped) {
            $dupCount += $grouped.Count
            if ($dupCount -le 5) {
                Write-Output ("  DUP in " + $f.Name + ": keys " + (($grouped | ForEach-Object { $_.Name }) -join ", "))
            }
        }
    }
    Write-Output ($f.Name + ": duplicate-key blocks found = " + $dupCount)
}

Write-Output ""
Write-Output "=== 3. QUESTION COUNT PER FILE ==="
foreach ($f in $files) {
    if ($f.Name -eq "tmp_fix.json") { continue }
    $text = [System.IO.File]::ReadAllText($f.FullName)
    $count = ([regex]::Matches($text, '"question"\s*:')).Count
    Write-Output ($f.Name + ": ~" + $count + " questions")
}