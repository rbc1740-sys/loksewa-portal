$ErrorActionPreference = "Stop"

function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    # \w keeps Unicode letters (incl. Devanagari) and digits
    return ($s.ToLower() -replace '[^\w]+', ' ').Trim()
}

# Sanitizer: remove trailing commas which break strict JSON parsers
function Get-SanitizedJson([string]$path) {
    $raw = Get-Content $path -Raw -Encoding UTF8
    $fixed = [regex]::Replace($raw, ',\s*(?=[}\]])', '')
    return ($fixed | ConvertFrom-Json)
}

# Source is an object: { title, total_questions, questions: [ {id, question, options, correct_answer, explanation} ] }
$src = Get-SanitizedJson "d:\gemini-code-1787451921800.json"
$qarr = $src.questions
Write-Output ("Source questions: " + $qarr.Count)

$merged = New-Object System.Collections.Generic.List[object]
foreach ($q in $qarr) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for id $($q.id): -> $ans"
    }
    $merged.Add([pscustomobject]@{
        topic       = "Geography of Nepal"
        number      = [int]$q.id
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
        Write-Output "Duplicate removed: id $($q.number) - $($q.question.Substring(0, [Math]::Min(60, $q.question.Length)))..."
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
        topic       = "Geography of Nepal"
        question    = $q.question
        options     = $cleanOpts
        answer      = $q.answer
        explanation = $q.explanation
    })
}

# --- Write output ---
$json = $final | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("questions\geography_of_nepal.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "Total input questions : $($merged.Count)"
Write-Output "Duplicates removed    : $dupCount"
Write-Output "Final questions saved : $($final.Count)"
