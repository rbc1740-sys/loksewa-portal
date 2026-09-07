$ErrorActionPreference = "Stop"
$j = Get-Content "D:\loksewa-portal\questions\geotechnical.json" -Raw | ConvertFrom-Json
Write-Output ("Total questions: " + $j.Count)
Write-Output ""
Write-Output "=== Existing questions with numeric id 1-45 ==="
foreach ($q in $j) {
    if ($q.id -match '^\d+$' -and [int]$q.id -le 45) {
        $t = $q.question
        if ($t.Length -gt 80) { $t = $t.Substring(0, 80) }
        Write-Output ("id=" + $q.id + "  " + $t)
    }
}