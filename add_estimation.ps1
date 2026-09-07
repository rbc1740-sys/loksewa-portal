$ErrorActionPreference = "Stop"

function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    return ($s.ToLower() -replace '[^a-z0-9]+', ' ').Trim()
}

$merged = New-Object System.Collections.Generic.List[object]

# Sanitizer: remove trailing commas (", }" or ", ]") which break strict JSON parsers
function Get-SanitizedJson([string]$path) {
    $raw = Get-Content $path -Raw -Encoding UTF8
    $fixed = [regex]::Replace($raw, ',\s*(?=[}\]])', '')
    return ($fixed | ConvertFrom-Json)
}

# --- File 1: Q1-168 (units, estimating, rate analysis, specifications) ---
$f1 = Get-SanitizedJson "d:\gemini-code-1787444701716.json"
foreach ($q in $f1) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Estimation"
        number      = [int]$q.question_number
        question    = $q.question
        options     = $q.options
        answer      = $ans
        explanation = $q.explanation
    })
}

# --- File 2: Q170-250 (estimation, valuation, specifications) ---
$f2 = Get-SanitizedJson "d:\gemini-code-1787444719265.json"
foreach ($q in $f2) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Estimation"
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
        topic       = "Estimation"
        question    = $q.question
        options     = $cleanOpts
        answer      = $q.answer
        explanation = $q.explanation
    })
}

# --- Write output ---
$json = $final | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("questions\estimation.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "Total input questions : $($merged.Count)"
Write-Output "Duplicates removed    : $dupCount"
Write-Output "Final questions saved : $($final.Count)"