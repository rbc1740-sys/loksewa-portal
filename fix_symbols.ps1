$path = "D:\loksewa-portal\questions\structural enginnering.json"
$content = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))

$replacements = @{
  "Ïƒ" = "σ"
  "Îµ" = "ε"
  "Î”" = "Δ"
  "Â°C" = "°C"
  "Â²" = "²"
  "Â³" = "³"
  "Ã—" = "×"
  "â€°" = "°"
  "â€“" = "–"
  "â€”" = "—"
  "â€˜" = "‘"
  "â€™" = "’"
  "â€œ" = "“"
  "â€" = "”"
  "â€¢" = "•"
  "âˆš" = "√"
  "â´" = "⁴"
  "Ï€" = "π"
  "Ï„" = "τ"
  "Î¸" = "θ"
  "Î£" = "Σ"
  "Î¼" = "μ"
  "Î±" = "α"
  "Î²" = "β"
  "Î³" = "γ"
  "Î·" = "η"
  "Î»" = "λ"
  "Î´" = "δ"
  "Îº" = "κ"
  "Î¾" = "ξ"
  "Î¶" = "ζ"
  "Ï‰" = "ω"
  "Ï" = "ρ"
}

foreach ($pair in $replacements.GetEnumerator()) {
  $content = $content.Replace($pair.Key, $pair.Value)
}

[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Output "updated symbols"
