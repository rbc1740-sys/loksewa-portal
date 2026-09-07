$path = "D:\loksewa-portal\questions\structural enginnering.json"
$content = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))

$replacements = @(
  @{ from = ([char]0x00CF + [char]0x0192); to = "σ" },
  @{ from = ([char]0x00CE + [char]0x03B5); to = "ε" },
  @{ from = ([char]0x00CE + [char]0x0394); to = "Δ" },
  @{ from = ([char]0x00C2 + [char]0x00B0 + [char]0x0043); to = "°C" },
  @{ from = ([char]0x00C2 + [char]0x00B2); to = "²" },
  @{ from = ([char]0x00C2 + [char]0x00B3); to = "³" },
  @{ from = ([char]0x00C3 + [char]0x00D7); to = "×" },
  @{ from = ([char]0x00CF + [char]0x03C4); to = "τ" },
  @{ from = ([char]0x00CF + [char]0x03C0); to = "π" },
  @{ from = ([char]0x00CE + [char]0x03B8); to = "θ" },
  @{ from = ([char]0x00CE + [char]0x03A3); to = "Σ" },
  @{ from = ([char]0x00CE + [char]0x03BC); to = "μ" },
  @{ from = ([char]0x00CE + [char]0x03B1); to = "α" },
  @{ from = ([char]0x00CE + [char]0x03B2); to = "β" },
  @{ from = ([char]0x00CE + [char]0x03B3); to = "γ" },
  @{ from = ([char]0x00CE + [char]0x03B7); to = "η" },
  @{ from = ([char]0x00CE + [char]0x03BB); to = "λ" },
  @{ from = ([char]0x00CE + [char]0x03B4); to = "δ" },
  @{ from = ([char]0x00CE + [char]0x03BA); to = "κ" },
  @{ from = ([char]0x00CE + [char]0x03BE); to = "ξ" },
  @{ from = ([char]0x00CE + [char]0x03BD); to = "ζ" },
  @{ from = ([char]0x00CF + [char]0x03C9); to = "ω" },
  @{ from = ([char]0x00CF + [char]0x03C1); to = "ρ" },
  @{ from = ([char]0x00E2 + [char]0x02C6 + [char]0x0161); to = "√" },
  @{ from = ([char]0x00E2 + [char]0x2074); to = "⁴" },
  @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x00B0); to = "°" },
  @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x201C); to = "“" },
  @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x201D); to = "”" },
  @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x2122); to = "™" },
  @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x00A2); to = "¢" }
)

foreach ($pair in $replacements) {
  $content = $content.Replace($pair.from, $pair.to)
}

[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Output "updated symbols"
