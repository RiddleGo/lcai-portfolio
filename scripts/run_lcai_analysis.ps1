# LCAI 本地研判 + 写入 reports/
# 用法: .\scripts\run_lcai_analysis.ps1 600519
param(
    [Parameter(Mandatory = $true)][string]$Symbol
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "========== LCAI 裁决 =========="
python (Join-Path $Root "scripts\lcai_screen_json.py") $Symbol
Write-Host ""
Write-Host "========== 写入 reports/ =========="
python (Join-Path $Root "scripts\generate_reports.py") --symbol $Symbol
$Out = Join-Path $Root "reports\$Symbol"
Write-Host "完成。报告见 $Out\unified.json 与 $Out\index.html"
