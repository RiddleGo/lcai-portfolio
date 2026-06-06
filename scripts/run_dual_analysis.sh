#!/usr/bin/env bash
# LCAI + UZI 双轨研判
# 用法: bash scripts/run_dual_analysis.sh 600519
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYMBOL="${1:?用法: run_dual_analysis.sh <代码或名称>}"
UZI_PATH="${UZI_SKILL_PATH:-$ROOT/.vendor/UZI-Skill}"
DEPTH="${UZI_DEPTH:-medium}"
SCHOOL="${UZI_SCHOOL:-A,E}"

echo "========== LCAI 裁决 =========="
python "$ROOT/scripts/lcai_screen_json.py" "$SYMBOL" || python "$ROOT/投资系统/engine/screen_stock.py" "$SYMBOL"

if [[ ! -f "$UZI_PATH/run.py" ]]; then
  echo ""
  echo "[跳过 UZI] 未找到 $UZI_PATH/run.py"
  echo "安装: git clone https://github.com/wbh604/UZI-Skill.git $UZI_PATH"
  echo "      pip install -r $UZI_PATH/requirements.txt"
  exit 0
fi

echo ""
echo "========== UZI 价值派研报 (school=$SCHOOL depth=$DEPTH) =========="
cd "$UZI_PATH"
python run.py "$SYMBOL" --depth "$DEPTH" --no-browser --school "$SCHOOL"

REPORT_DIR="$UZI_PATH/skills/deep-analysis/scripts/reports"
echo ""
echo "UZI 报告目录: $REPORT_DIR"
ls -lt "$REPORT_DIR" 2>/dev/null | head -5 || true

# 同步到 LCAI reports/
OUT="$ROOT/reports/$(echo "$SYMBOL" | tr -d '.')"
mkdir -p "$OUT"
LATEST=$(find "$REPORT_DIR" -name "*.html" -type f 2>/dev/null | head -1 || true)
if [[ -n "$LATEST" ]]; then
  cp "$LATEST" "$OUT/index.html"
  echo "已复制: $OUT/index.html"
fi

python "$ROOT/scripts/generate_uzi_reports.py" --symbol "$SYMBOL" --uzi-path "$UZI_PATH" 2>/dev/null || true

echo ""
echo "完成。LCAI 裁决见上方 JSON；UZI HTML 见 $OUT/index.html"
