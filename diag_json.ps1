$ErrorActionPreference = "Stop"
$path = 'd:\loksewa-portal\New folder\New folder\Geographical Divesity, Climatic Condition & Cultures.json'
$raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$cr = [char]13; $sp = [char]32; $nl = [char]10
$fixed = $raw.Replace($cr, $sp).Replace($nl, $sp)
$fixed = [regex]::Replace($fixed, ',\s*(?=[}\]])', '')

# Find position 56757 context
$pos = 56757
$start = [math]::Max(0, $pos - 250)
$end = [math]::Min($fixed.Length, $pos + 250)
Write-Output "=== Context around position 56757 ==="
Write-Output ($fixed.Substring($start, $end - $start))
Write-Output ""

# Try parsing and capture the exact error
try {
    $fixed | ConvertFrom-Json
    Write-Output "Parsed OK"
} catch {
    $msg = $_.Exception.Message
    $errObj = $_.FullyQualifiedErrorId
    Write-Output ("Error: " + $msg)
    Write-Output ("ErrorId: " + $errObj)
}

# Count quotes to find imbalance - simple heuristic
$quoteCount = ($fixed.ToCharArray() | Where-Object { $_ -eq '"' }).Count
Write-Output ("Total double-quote count: " + $quoteCount)
Write-Output ("Even? " + ($quoteCount % 2 -eq 0))
