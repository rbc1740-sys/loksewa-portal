$ErrorActionPreference = "Stop"

function Normalize([string]$s) {
    if ($null -eq $s) { $s = "" }
    return ($s.ToLower() -replace '[^\w]+', ' ').Trim()
}

# Sanitizer: collapse bare newlines inside JSON string values + remove trailing commas
# Uses [char] constants to avoid backtick escaping issues
function Get-SanitizedJson([string]$path) {
    $nl = [char]10   # newline
    $cr = [char]13   # carriage return
    $sp = [char]32   # space
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $fixed = $raw.Replace($cr, $sp).Replace($nl, $sp)
    # Remove trailing commas which break strict JSON parsers
    $fixed = [regex]::Replace($fixed, ',\s*(?=[}\]])', '')
    return ($fixed | ConvertFrom-Json)
}

# Source is an object: { exam_title, source, total_questions, questions: [ {question_number, question_text, options, correct_answer, explanation} ] }
$src = Get-SanitizedJson "d:\loksewa-portal\New folder\New folder\Geographical Divesity, Climatic Condition & Cultures.json"
$qarr = $src.questions
Write-Output ("Source questions: " + $qarr.Count)

$merged = New-Object System.Collections.Generic.List[object]
foreach ($q in $qarr) {
    $ans = $q.correct_answer
    if ($null -eq $ans) { $ans = $q.answer }
    if ($ans -notin @("a","b","c","d")) {
        if ($ans -eq "e") { $ans = "d" } else { $ans = "a" }
        Write-Output "Fixed invalid answer for qn $($q.question_number): -> $ans"
    }

    $merged.Add([pscustomobject]@{
        topic       = "Geographical Divesity, Climatic Condition & Cultures"
        number      = [int]$q.question_number
        question    = $q.question_text
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
        Write-Output "Duplicate removed: qn $($q.number) - $($q.question.Substring(0, [Math]::Min(60, $q.question.Length)))..."
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
        topic       = "Geographical Divesity, Climatic Condition & Cultures"
        question    = $q.question
        options     = $cleanOpts
        answer      = $q.answer
        explanation = $q.explanation
    })
}

# --- Write output ---
$json = $final | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("questions\geographical_diversity_climatic_condition_cultures.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ""
Write-Output "Total input questions : $($merged.Count)"
Write-Output "Duplicates removed    : $dupCount"
Write-Output "Final questions saved : $($final.Count)"
