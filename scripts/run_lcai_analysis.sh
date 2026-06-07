#!/usr/bin/env bash
# LCAI 本地研判 + 写入 reports/
# 用法: bash scripts/run_lcai_analysis.sh 600519
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYMBOL="${1:?用法: run_lcai_analysis.sh <代码>}"

echo "========== LCAI 裁决 =========="
python "$ROOT/scripts/lcai_screen_json.py" "$SYMBOL"
echo ""
echo "========== 写入 reports/ =========="
python "$ROOT/scripts/generate_reports.py" --symbol "$SYMBOL"
OUT="$ROOT/reports/$SYMBOL"
echo "完成。报告见 $OUT/unified.json 与 $OUT/index.html"
