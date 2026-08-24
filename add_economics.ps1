$ErrorActionPreference = "Stop"

function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    return ($s.ToLower() -replace '[^a-z0-9]+', ' ').Trim()
}

# Sanitizer: remove trailing commas which break strict JSON parsers
function Get-SanitizedJson([string]$path) {
    $raw = Get-Content $path -Raw -Encoding UTF8
    $fixed = [regex]::Replace($raw, ',\s*(?=[}\]])', '')
    return ($fixed | ConvertFrom-Json)
}

$merged = New-Object System.Collections.Generic.List[object]

# --- File 1: Q1-87 (interest, annuities, break-even, demand/supply) ---
$f1 = Get-SanitizedJson "d:\gemini-code-1787448063509.json"
foreach ($q in $f1) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Engineering Economics"
        number      = [int]$q.question_number
        question    = $q.question
        options     = $q.options
        answer      = $ans
        explanation = $q.explanation
    })
}

# --- File 2: Q88-127 (NPV, IRR, B/C ratio, financial analysis) ---
$f2 = Get-SanitizedJson "d:\gemini-code-1787448068725.json"
foreach ($q in $f2) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Engineering Economics"
        number      = [int]$q.question_number
        question    = $q.question
        options     = $q.options
        answer      = $ans
        explanation = $q.explanation
    })
}

# --- Sort by question number ---
$sorted = $merged | Sort-Object number

# --- Remove content duplicates (same question + same options) ---
$seen = @{}
$final = New-Object System.Collections.Generic.List[object]
$dupCount = 0
foreach ($q in $sorted) {
    $opts = @()
    if ($q.options) {
        $q.options.PSObject.Properties | ForEach-Object {
            $v = Normalize $_.Value
            if ($v) { $opts += $v }
        }
    }
    $sig = "$(Normalize $q.question)::$(($opts | Sort-Object) -join '|')"
    if ($seen.ContainsKey($sig)) {
        $dupCount++
        Write-Output "Duplicate removed: Q$($q.number) - $($q.question.Substring(0, [Math]::Min(60, $q.question.Length)))..."
        continue
    }
    $seen[$sig] = $true

    $cleanOpts = [ordered]@{}
    foreach ($k in @("a","b","c","d")) {
        if ($q.options.PSObject.Properties[$k]) {
            $cleanOpts[$k] = $q.options.$k
        }
    }

    $final.Add([pscustomobject]@{
        topic       = "Engineering Economics"
        question    = $q.question
        options     = $cleanOpts
        answer      = $q.answer
        explanation = $q.explanation
    })
}

# --- Write output ---
$json = $final | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("questions\engineering_economics.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "Total input questions : $($merged.Count)"
Write-Output "Duplicates removed    : $dupCount"
Write-Output "Final questions saved : $($final.Count)"