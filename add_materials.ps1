$ErrorActionPreference = "Stop"

$parts = @(
    "D:\gemini-code-1787395944285.json",
    "D:\gemini-code-1787396091681.json",
    "D:\gemini-code-1787396523316.json"
)

function Clean-Text {
    param([string]$inText)
    if ([string]::IsNullOrEmpty($inText)) { return $inText }

    # Remove citation artifacts like [cite: 1] or [cite: 1, 3]
    $inText = [regex]::Replace($inText, '\[\s*cite\s*:\s*[\d,\s]+\s*\]', '')
    $inText = $inText -replace '\[\s*cite\s*\]', ''

    # LaTeX to readable text (single backslash before letter)
    $inText = [regex]::Replace($inText, '\\frac\{([^{}]+)\}\{([^{}]+)\}', '($1)/($2)')
    $inText = [regex]::Replace($inText, '\\sqrt\{([^{}]+)\}', 'sqrt($1)')
    $inText = [regex]::Replace($inText, '\\text\{([^{}]*)\}', '$1')

    $DPi      = [string][char]0x03C0
    $DTheta   = [string][char]0x03B8
    $DDelt    = [string][char]0x0394
    $DSigma   = [string][char]0x03A3
    $DAlpha   = [string][char]0x03B1
    $DBeta    = [string][char]0x03B2
    $DGamma   = [string][char]0x03B3
    $DMu      = [string][char]0x03BC
    $DRho     = [string][char]0x03C1
    $DLambda  = [string][char]0x03BB
    $DOmega   = [string][char]0x03C9
    $Dtimes   = [string][char]0x00D7
    $Dapprox  = [string][char]0x2248
    $Dleq     = [string][char]0x2264
    $Dgeq     = [string][char]0x2265
    $Ddeg     = [string][char]0x00B0
    $Ddot     = [string][char]0x00B7
    $Ddiv     = [string][char]0x00F7
    $Dpm      = [string][char]0x00B1
    $DImplies = [string][char]0x21D2
    $DSup2    = [string][char]0x00B2
    $DSup3    = [string][char]0x00B3
    $DSup4    = [string][char]0x2074
    $DSqrt    = [string][char]0x221A

    $pairs = @{
        "\pi"     = $DPi
        "\theta"  = $DTheta
        "\Delta"  = $DDelt
        "\Sigma"  = $DSigma
        "\alpha"  = $DAlpha
        "\beta"   = $DBeta
        "\gamma"  = $DGamma
        "\mu"     = $DMu
        "\rho"    = $DRho
        "\lambda" = $DLambda
        "\omega"  = $DOmega
        "\times"  = $Dtimes
        "\approx" = $Dapprox
        "\leq"    = $Dleq
        "\geq"    = $Dgeq
        "\deg"    = $Ddeg
        "\circ"   = $Ddeg
        "\cdot"   = $Ddot
        "\div"    = $Ddiv
        "\pm"     = $Dpm
        "\sin"    = "sin"
        "\cos"    = "cos"
        "\tan"    = "tan"
        "\sqrt"   = $DSqrt
        "\mathrm" = ""
        "\text"   = ""
        "\left"   = ""
        "\right"  = ""
    }
    foreach ($k in $pairs.Keys) {
        $inText = $inText.Replace($k, $pairs[$k])
    }

    $inText = $inText.Replace('{', '').Replace('}', '')
    $inText = $inText.Replace('^2', $DSup2).Replace('^3', $DSup3).Replace('^4', $DSup4)
    $inText = [regex]::Replace($inText, '\^\d+', '')
    $inText = $inText.Replace('$', '').Replace('`', '')

    # Catch-all: convert \frac to slash, strip ALL remaining backslashes
    $inText = $inText.Replace('\frac', '/')
    $inText = $inText -replace '\\', ''

    $inText = $inText -replace '\s+', ' '
    return $inText.Trim()
}

$out = @()
$qn = 0
$skipped = @()

foreach ($part in $parts) {
    if (-not (Test-Path $part)) {
        Write-Output "MISSING: $part"
        continue
    }
    $raw = [System.IO.File]::ReadAllText($part, [System.Text.UTF8Encoding]::new($false))
    $raw = $raw -replace "`r`n", ' ' -replace "`n", ' ' -replace "`r", ' '
    # Rule 1: Normalize ANY run of 2+ backslashes (not directly before a quote
    # or slash) to exactly two backslashes => valid JSON for one literal '\'.
    $raw = [regex]::Replace($raw, '\\{2,}(?![\\"/])', '\\\\')
    # Rule 2: Escape LONE backslashes (not preceded by another backslash) that
    # are not valid JSON escapes (\", \\, \/, \b, \f, \n, \r, \t, \u) -
    # e.g. \% \{ \} \, \space \± etc.
    $raw = [regex]::Replace($raw, '(?<!\\)\\(?![\\"/bfnrtu])', '\\\\')

    try {
        $parsed = $raw | ConvertFrom-Json
    } catch {
        Write-Output "PARSE FAILED for $part"
        throw $_
    }

    # Handle both array format and { "mcqs": [...] } object format
    $data = $null
    if ($parsed -is [System.Array]) {
        $data = $parsed
    } elseif ($parsed.mcqs) {
        $data = $parsed.mcqs
    } else {
        Write-Output "UNKNOWN FORMAT for $part"
        continue
    }

    foreach ($q in $data) {
        $qn++
        $answer = if ($q.correct_answer) { $q.correct_answer } elseif ($q.answer) { $q.answer } else { $null }
        if (-not $answer) {
            $skipped += "$qn : $($q.question)"
            continue
        }
        $srcQn = if ($q.question_number) { $q.question_number } else { $qn }
        # [ordered] preserves insertion order; Sort-Object guarantees A,B,C,D...
        $cleanOpts = [ordered]@{}
        if ($q.options) {
            foreach ($prop in ($q.options.PSObject.Properties | Sort-Object Name)) {
                $cleanOpts[$prop.Name] = Clean-Text ([string]$prop.Value)
            }
        }
        $out += [ordered]@{
            question    = Clean-Text $q.question
            topic       = "Construction Materials"
            options     = $cleanOpts
            answer      = $answer.ToString().ToLower()
            explanation = if ($q.explanation) { Clean-Text $q.explanation } else { "" }
            qn          = "$srcQn"
        }
    }
}

# Quick sanity check on first output entry before writing
if ($out.Count -gt 0) {
    Write-Output "SANITY: first question = $($out[0].question)"
    Write-Output "SANITY: first option a = $($out[0].options['a'])"
    Write-Output "SANITY: first qn = $($out[0].qn)"
}

$outPath = Join-Path (Get-Location) "questions\construction_materials.json"
$json = $out | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($true))
Write-Output "Wrote $($out.Count) construction material questions to $outPath"
if ($skipped.Count -gt 0) {
    Write-Output "Skipped (no answer): $($skipped -join '; ')"
}