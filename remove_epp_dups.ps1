$ErrorActionPreference = "Stop"
function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    return ($s.ToLower() -replace '[^\w]+', ' ').Trim()
}

$path = "questions\engineering_professional_practice.json"
$d = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json

# Load all other question files to build the "seen" signature set
$seen = @{}
Get-ChildItem "questions\*.json" | Where-Object { $_.Name -ne "engineering_professional_practice.json" } | ForEach-Object {
    $data = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($q in $data) {
        $opts = @()
        if ($q.options) {
            $q.options.PSObject.Properties | ForEach-Object {
                $v = Normalize $_.Value
                if ($v) { $opts += $v }
            }
        }
        $sig = "$(Normalize $q.question)::$(($opts | Sort-Object) -join '|')"
        if ($sig -ne "::") { $seen[$sig] = $true }
    }
}

$kept = New-Object System.Collections.Generic.List[object]
$removed = 0
foreach ($q in $d) {
    $opts = @()
    if ($q.options) {
        $q.options.PSObject.Properties | ForEach-Object {
            $v = Normalize $_.Value
            if ($v) { $opts += $v }
        }
    }
    $sig = "$(Normalize $q.question)::$(($opts | Sort-Object) -join '|')"
    if ($seen.ContainsKey($sig)) {
        $removed++
        Write-Output ("Removed cross-file duplicate: " + $q.question.Substring(0, [Math]::Min(60, $q.question.Length)) + "...")
        continue
    }
    $kept.Add($q)
}

$json = $kept | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output ("Removed: " + $removed)
Write-Output ("Final count: " + $kept.Count)