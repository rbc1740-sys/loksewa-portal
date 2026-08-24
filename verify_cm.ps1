$d = Get-Content "questions\construction_management.json" -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("Count: " + $d.Count)
Write-Output "--- First question ---"
$d[0] | ConvertTo-Json -Depth 5
Write-Output "--- Last question ---"
$d[$d.Count - 1] | ConvertTo-Json -Depth 5
Write-Output "--- Topics ---"
$d | Group-Object topic | ForEach-Object { $_.Name + ": " + $_.Count }
$badAns = @($d | Where-Object { $_.answer -notin @("a","b","c","d") })
Write-Output ("Invalid answers: " + $badAns.Count)
$noOpts = @($d | Where-Object { -not $_.options -or $_.options.PSObject.Properties.Count -lt 2 })
Write-Output ("Questions with <2 options: " + $noOpts.Count)