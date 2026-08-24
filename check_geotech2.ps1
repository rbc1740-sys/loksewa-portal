$ErrorActionPreference = "Stop"
$j = Get-Content "D:\loksewa-portal\questions\geotechnical.json" -Raw | ConvertFrom-Json
Write-Output ("Total questions: " + $j.Count)

# All numeric ids sorted
$numericIds = @()
foreach ($q in $j) {
    if ($q.id -match '^\d+$') { $numericIds += [int]$q.id }
}
$sorted = $numericIds | Sort-Object
Write-Output ("Numeric id count: " + $sorted.Count)
Write-Output ("Min: " + $sorted[0] + "  Max: " + $sorted[$sorted.Count - 1])

# Find duplicates
$dups = $sorted | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dups) {
    Write-Output "DUPLICATE IDS FOUND:"
    foreach ($d in $dups) {
        Write-Output ("  id=" + $d.Name + " appears " + $d.Count + " times")
    }
} else {
    Write-Output "No duplicate ids."
}

# Show ids in ranges 40-70 to see what exists
Write-Output ""
Write-Output "=== Questions with numeric id between 40 and 70 ==="
foreach ($q in $j) {
    if ($q.id -match '^\d+$') {
        $n = [int]$q.id
        if ($n -ge 40 -and $n -le 70) {
            $t = $q.question
            if ($t.Length -gt 70) { $t = $t.Substring(0, 70) }
            Write-Output ("id=" + $q.id + "  " + $t)
        }
    }
}