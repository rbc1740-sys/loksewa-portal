# Verifies JSON validity and shows the fixed symbol questions
$g = Get-Content 'questions\geotechnical.json' -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("geotechnical.json parsed OK - " + $g.mcqs.Count + " questions")

$q = $g.mcqs | Where-Object { $_.question -match 'dry density' } | Select-Object -First 1
Write-Output ("Q: " + $q.question)
$q.options.PSObject.Properties | ForEach-Object { Write-Output ("  " + $_.Name + ") " + $_.Value) }

$s = Get-Content 'questions\surveying.json' -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("surveying.json parsed OK - " + $s.mcqs.Count + " questions")
$s.mcqs | Where-Object { $_.question -match [char]0x03B8 } | Select-Object -First 1 | ForEach-Object {
    Write-Output ("Q: " + $_.question)
    $_.options.PSObject.Properties | ForEach-Object { Write-Output ("  " + $_.Name + ") " + $_.Value) }
    Write-Output ("  explanation: " + $_.explanation)
}

# Check no plain-text words remain anywhere
$leftover = Get-ChildItem 'questions\*.json' | ForEach-Object {
    $t = [IO.File]::ReadAllText($_.FullName)
    if ($t -match '\b(gamma|theta|alpha)\b') { $_.Name }
}
if ($leftover) { Write-Output ("WARNING, still contains plain-text symbols: " + ($leftover -join ', ')) }
else { Write-Output "No plain-text gamma/theta/alpha remain in any question file." }