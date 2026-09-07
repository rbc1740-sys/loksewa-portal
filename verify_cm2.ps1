$d = Get-Content "questions\construction_management.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$bad = 0
foreach ($q in $d) {
    $n = 0
    foreach ($p in $q.options.PSObject.Properties) { $n++ }
    if ($n -lt 2) { $bad++; Write-Output ("LOW OPTIONS Q: " + $q.question) }
}
Write-Output ("Questions with fewer than 2 options: " + $bad)