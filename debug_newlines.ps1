$ErrorActionPreference = "Stop"

$path = "d:\loksewa-portal\New folder\New folder\Geographical Divesity, Climatic Condition & Cultures.json"
$raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$beforeLF = ($raw.ToCharArray() | Where-Object { $_ -eq [char]10 }).Count
$beforeCR = ($raw.ToCharArray() | Where-Object { $_ -eq [char]13 }).Count
Write-Output ("Raw length: " + $raw.Length)
Write-Output ("Newlines (LF) before: " + $beforeLF)
Write-Output ("Carriage returns (CR) before: " + $beforeCR)

# Check what kind of line breaks are between the exam_title value
$idx = $raw.IndexOf("exam_title")
$segment = $raw.Substring($idx, 200)
Write-Output ("Segment around exam_title:")
for ($j = 0; $j -lt $segment.Length; $j++) {
    $c = $segment[$j]
    if ($c -eq [char]10) { Write-Output "[$j] = LF(newline)" }
    elseif ($c -eq [char]13) { Write-Output "[$j] = CR" }
    elseif ($c -eq [char]32) { Write-Output "[$j] = SPACE" }
}

# Try the replacement
$nl = [char]10
$cr = [char]13
$sp = [char]32
$fixed = $raw.Replace($cr, $sp).Replace($nl, $sp)

$afterLF = ($fixed.ToCharArray() | Where-Object { $_ -eq [char]10 }).Count
$afterCR = ($fixed.ToCharArray() | Where-Object { $_ -eq [char]13 }).Count
Write-Output ("Newlines (LF) after: " + $afterLF)
Write-Output ("Carriage returns (CR) after: " + $afterCR)

# Write to temp file for inspection
[System.IO.File]::WriteAllText("d:\loksewa-portal\debug_output.json", $fixed, (New-Object System.Text.UTF8Encoding($false)))

# Try parsing
try {
    $fixed2 = [regex]::Replace($fixed, ',\s*(?=[}\]])', '')
    $data = $fixed2 | ConvertFrom-Json
    Write-Output ("Parse SUCCESS! Questions: " + $data.questions.Count)
} catch {
    Write-Output ("Parse FAILED: " + $_.Exception.Message)
    # Find the error position
    $pos = 56757
    if ($fixed.Length -gt $pos) {
        Write-Output ("Char at pos $pos: [" + $fixed[$pos] + "]")
        Write-Output ("Context around pos $pos:")
        $start = [Math]::Max(0, $pos - 50)
        $end = [Math]::Min($fixed.Length, $pos + 50)
        Write-Output ($fixed.Substring($start, $end - $start))
    }
}
