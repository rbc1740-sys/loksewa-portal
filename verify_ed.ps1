$d = Get-Content "questions\engineering_drawing.json" -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("Count: " + $d.Count)
$topics = $d | Group-Object topic | ForEach-Object { $_.Name + ": " + $_.Count }
Write-Output ("Topics: " + ($topics -join ", "))
$badAns = 0
$badOpts = 0
$fiveOpt = 0
foreach ($q in $d) {
    if ($q.answer -notin @("a","b","c","d","e")) { $badAns++ }
    $n = 0
    foreach ($p in $q.options.PSObject.Properties) { $n++ }
    if ($n -lt 2) { $badOpts++ }
    if ($n -ge 5) { $fiveOpt++ }
}
Write-Output ("Invalid answers: " + $badAns)
Write-Output ("Questions with <2 options: " + $badOpts)
Write-Output ("Questions with 5 options (kept): " + $fiveOpt)
Write-Output "--- Q92 (fixed) ---"
$d | Where-Object { $_.question -like "*Axonometric view/drawing*" } | Select-Object -First 1 | ConvertTo-Json -Depth 5