$d = Get-Content "questions\estimation.json" -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("Count: " + $d.Count)
$topics = $d | Group-Object topic | ForEach-Object { $_.Name + ": " + $_.Count }
Write-Output ("Topics: " + ($topics -join ", "))
$badAns = 0
$badOpts = 0
foreach ($q in $d) {
    if ($q.answer -notin @("a","b","c","d")) { $badAns++ }
    $n = 0
    foreach ($p in $q.options.PSObject.Properties) { $n++ }
    if ($n -lt 2) { $badOpts++ }
}
Write-Output ("Invalid answers: " + $badAns)
Write-Output ("Questions with <2 options: " + $badOpts)
Write-Output "--- First question ---"
$d[0] | ConvertTo-Json -Depth 5