# LCAI + UZI 双轨研判 (PowerShell)
# 用法: .\scripts\run_dual_analysis.ps1 600519
param(
    [Parameter(Mandatory = $true)][string]$Symbol,
    [string]$UziPath = "",
    [string]$Depth = "medium",
    [string]$School = "A,E"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $UziPath) { $UziPath = Join-Path $Root ".vendor\UZI-Skill" }

Write-Host "========== LCAI 裁决 =========="
python (Join-Path $Root "scripts\lcai_screen_json.py") $Symbol
if ($LASTEXITCODE -ne 0) {
    python (Join-Path $Root "投资系统\engine\screen_stock.py") $Symbol
}

if (-not (Test-Path (Join-Path $UziPath "run.py"))) {
    Write-Host ""
    Write-Host "[跳过 UZI] 未找到 $UziPath\run.py"
    Write-Host "安装: git clone https://github.com/wbh604/UZI-Skill.git $UziPath"
    exit 0
}

Write-Host ""
Write-Host "========== UZI 价值派研报 =========="
Push-Location $UziPath
python run.py $Symbol --depth $Depth --no-browser --school $School
Pop-Location

$Out = Join-Path $Root "reports\$($Symbol -replace '\.','')"
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$ReportDir = Join-Path $UziPath "skills\deep-analysis\scripts\reports"
$html = Get-ChildItem -Path $ReportDir -Filter "*.html" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($html) {
    Copy-Item $html.FullName (Join-Path $Out "index.html")
    Write-Host "已复制: $Out\index.html"
}

python (Join-Path $Root "scripts\generate_uzi_reports.py") --symbol $Symbol --uzi-path $UziPath
