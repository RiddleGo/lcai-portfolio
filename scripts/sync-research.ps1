# 从本地投资工作区同步 Markdown 到 GitHub Pages
$src = "d:\投资\投资研究"
$dst = Join-Path $PSScriptRoot "..\docs\research"
if (-not (Test-Path $src)) {
  Write-Error "Source not found: $src"
  exit 1
}
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item (Join-Path $src "*.md") $dst -Force
Write-Host "Synced from $src to $dst"
