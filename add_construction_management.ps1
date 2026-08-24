$ErrorActionPreference = "Stop"

function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    return ($s.ToLower() -replace '[^a-z0-9]+', ' ').Trim()
}

$merged = New-Object System.Collections.Generic.List[object]

# --- File 1: wrapper object with "questions" array (Q1-127) ---
$f1 = Get-Content "d:\gemini-code-1787443650527.json" -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($q in $f1.questions) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    # Fix invalid answer keys (e.g., "e" when only a-d exist)
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Construction Management"
        number      = [int]$q.question_number
        question    = $q.question
        options     = $q.options
        answer      = $ans
        explanation = $q.explanation
    })
}

# --- File 2: plain array (Q131-251), uses correct_answer ---
$f2 = Get-Content "d:\gemini-code-1787443877993.json" -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($q in $f2) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Construction Management"
        number      = [int]$q.question_number
        question    = $q.question
        options     = $q.options
        answer      = $ans
        explanation = $q.explanation
    })
}

# --- File 3: plain array (Q252-305), uses answer ---
$f3 = Get-Content "d:\gemini-code-1787443889180.json" -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($q in $f3) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for Q$($q.question_number): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Construction Management"
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

    # Clean options: keep only a-d keys present
    $cleanOpts = [ordered]@{}
    foreach ($k in @("a","b","c","d")) {
        if ($q.options.PSObject.Properties[$k]) {
            $cleanOpts[$k] = $q.options.$k
        }
    }

    $final.Add([pscustomobject]@{
        topic       = "Construction Management"
        question    = $q.question
        options     = $cleanOpts
        answer      = $q.answer
        explanation = $q.explanation
    })
}

# --- Write output ---
$json = $final | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("questions\construction_management.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "Total input questions : $($merged.Count)"
Write-Output "Duplicates removed    : $dupCount"
Write-Output "Final questions saved : $($final.Count)"