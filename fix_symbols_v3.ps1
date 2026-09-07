# Converts remaining plain-text Greek symbol words to Unicode symbols
# e.g. gamma_d -> γd , gamma -> γ , theta -> θ , alpha -> α

$files = Get-ChildItem "questions\*.json"

# Ordered so longer names (gamma_d, gamma_w) are replaced before bare "gamma"
$pairs = [ordered]@{
    'gamma_d' = [char]0x03B3 + 'd'   # γd
    'gamma_w' = [char]0x03B3 + 'w'   # γw
    '\bgamma\b' = [string][char]0x03B3   # γ
    '\btheta\b' = [string][char]0x03B8   # θ
    '\balpha\b' = [string][char]0x03B1   # α
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($f in $files) {
    $text = [IO.File]::ReadAllText($f.FullName)
    $original = $text

    foreach ($key in $pairs.Keys) {
        $text = [regex]::Replace($text, $key, $pairs[$key])
    }

    if ($text -ne $original) {
        [IO.File]::WriteAllText($f.FullName, $text, $utf8NoBom)
        Write-Output "Fixed symbols in: $($f.Name)"
    } else {
        Write-Output "No changes needed: $($f.Name)"
    }
}

Write-Output "Done."