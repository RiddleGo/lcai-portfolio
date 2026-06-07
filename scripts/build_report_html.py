#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 lcai + unified 生成 reports/{symbol}/index.html。"""
from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any


def _esc(v: Any) -> str:
    if v is None:
        return "—"
    return html.escape(str(v))


def _list_items(items: list | None, empty: str = "暂无") -> str:
    if not items:
        return f"<li>{_esc(empty)}</li>"
    return "".join(f"<li>{_esc(x)}</li>" for x in items)


def build_report_html(
    symbol: str,
    lcai: dict,
    unified: dict,
    compare: dict | None = None,
) -> str:
    compare = compare or {}
    name = lcai.get("name") or unified.get("name") or symbol
    verdict = lcai.get("verdict") or (unified.get("verdict") or {}).get("value") or "—"
    action = lcai.get("verdict_action") or (unified.get("verdict") or {}).get("action") or "—"
    rating = lcai.get("rating") or (unified.get("verdict") or {}).get("rating") or "—"
    score = lcai.get("overall_score") or (unified.get("verdict") or {}).get("score") or "—"
    executive = unified.get("executive") or compare.get("executive") or ""
    detailed = unified.get("summary_detailed") or (lcai.get("analysis") or {}).get("summary_detailed") or ""
    key_metrics = unified.get("key_metrics") or (lcai.get("analysis") or {}).get("key_metrics") or []
    valuation = (unified.get("valuation") or {}).get("narrative") or ""
    generated = unified.get("generated_at") or compare.get("generated_at") or ""
    layers = unified.get("layers") or []
    strengths = unified.get("strengths") or []
    weaknesses = unified.get("weaknesses") or []
    final = unified.get("final_conclusion") or (lcai.get("analysis") or {}).get("final_conclusion") or {}

    fc_block = ""
    if final:
        reasons = "".join(f"<li>{_esc(r)}</li>" for r in (final.get("reasons") or []))
        actions = "".join(f"<li>{_esc(a)}</li>" for a in (final.get("actions") or []))
        fc_block = f"""<section class="card" style="border-color:#3b82f6">
    <h2>最终结论</h2>
    <p style="font-size:1.05rem;font-weight:700">{_esc(final.get('headline') or f"{verdict} — {action}")}</p>
    {f'<p style="color:#94a3b8;font-size:0.85rem;margin:8px 0 4px">核心理由</p><ul>{reasons}</ul>' if reasons else ''}
    {f'<p style="color:#94a3b8;font-size:0.85rem;margin:8px 0 4px">你可以怎么做</p><ul>{actions}</ul>' if actions else ''}
  </section>"""

    metrics_rows = ""
    for m in key_metrics:
        st = m.get("status") or "neutral"
        st_cls = "ok" if st == "ok" else "bad" if st == "fail" else ""
        metrics_rows += f"""<tr class="{st_cls}">
          <td>{_esc(m.get('label'))}</td>
          <td><strong>{_esc(m.get('value'))}</strong></td>
          <td>{_esc(m.get('threshold'))}</td>
          <td>{_esc(m.get('note'))}</td>
        </tr>"""

    decision_rows = ""
    decision_path = unified.get("decision_path") or (lcai.get("analysis") or {}).get("decision_path") or []
    for s in decision_path:
        ok_cls = "ok" if s.get("ok") else "bad"
        decision_rows += f"""<div class="decision-step {ok_cls}">
          <span class="step-n">{_esc(s.get('step'))}</span>
          <div><strong>{_esc(s.get('title'))}</strong><br>{_esc(s.get('detail'))}</div>
        </div>"""

    layer_rows = ""
    for layer in layers:
        st = layer.get("lcai_status") or "—"
        st_cls = "ok" if st == "通过" else "bad" if st == "未通过" else "warn"
        layer_rows += f"""
        <section class="layer">
          <h3>{_esc(layer.get('title') or layer.get('layer'))} <span class="tag {st_cls}">{_esc(st)}</span></h3>
          <p>{_esc(layer.get('merged_summary') or layer.get('lcai_summary') or '')}</p>
        </section>"""

    dash_url = "https://riddlego.github.io/lcai-portfolio/%E8%B5%84%E4%BA%A7%E6%80%BB%E8%A7%88.html#screen"

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{_esc(name)} ({symbol}) · LCAI 综合研判</title>
  <style>
    :root {{ font-family: system-ui, "Segoe UI", sans-serif; background: #0f1419; color: #e7ecf1; line-height: 1.55; }}
    body {{ max-width: 820px; margin: 0 auto; padding: 24px 16px 48px; }}
    a {{ color: #60a5fa; }}
    h1 {{ font-size: 1.5rem; margin: 0 0 8px; }}
    h2 {{ font-size: 1.05rem; margin: 0 0 10px; color: #94a3b8; }}
    .meta {{ color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px; }}
    .verdict {{ display: inline-block; padding: 6px 14px; border-radius: 8px; font-weight: 700; margin: 8px 0 16px;
      background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; }}
    .verdict.buy {{ background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #6ee7b7; }}
    .verdict.hold {{ background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); color: #fcd34d; }}
    .card {{ background: #1a2332; border: 1px solid #2d3748; border-radius: 10px; padding: 16px; margin-bottom: 16px; }}
    .card.muted {{ opacity: 0.85; }}
    .layer {{ margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #2d3748; }}
    .layer:last-child {{ border-bottom: none; }}
    .layer h3 {{ font-size: 0.95rem; margin: 0 0 6px; }}
    .tag {{ font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; margin-left: 6px; }}
    .tag.ok {{ background: rgba(16,185,129,0.2); color: #6ee7b7; }}
    .tag.warn {{ background: rgba(245,158,11,0.2); color: #fcd34d; }}
    .tag.bad {{ background: rgba(239,68,68,0.2); color: #fca5a5; }}
    .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
    @media (max-width: 600px) {{ .cols {{ grid-template-columns: 1fr; }} }}
    ul {{ margin: 0; padding-left: 1.2rem; }}
    footer {{ margin-top: 24px; font-size: 0.8rem; color: #64748b; }}
    pre {{ white-space: pre-wrap; font-family: inherit; margin: 0; }}
    table.metrics {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; }}
    table.metrics th, table.metrics td {{ padding: 8px 10px; border-bottom: 1px solid #2d3748; text-align: left; }}
    table.metrics th {{ color: #94a3b8; font-weight: 600; }}
    table.metrics tr.ok td:nth-child(2) {{ color: #6ee7b7; }}
    table.metrics tr.bad td:nth-child(2) {{ color: #fca5a5; }}
    .decision-step {{ display: flex; gap: 12px; margin-bottom: 10px; padding: 10px; border-radius: 8px; background: #0f1419; }}
    .decision-step .step-n {{ flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem; background: #334155; }}
    .decision-step.ok .step-n {{ background: rgba(16,185,129,0.25); color: #6ee7b7; }}
    .decision-step.bad .step-n {{ background: rgba(239,68,68,0.25); color: #fca5a5; }}
  </style>
</head>
<body>
  <p><a href="{dash_url}">← 返回资产总览 · 选股</a></p>
  <h1>{_esc(name)} <span style="font-weight:400;color:#94a3b8">({symbol})</span></h1>
  <p class="meta">评级 {_esc(rating)} · 总分 {_esc(score)}{f' · 更新 {_esc(generated)}' if generated else ''}</p>
  <p class="verdict {'buy' if verdict == '买入' else 'hold' if verdict in ('观察', '持有', '数据不足') else ''}">{_esc(verdict)} — {_esc(action)}</p>

  {fc_block}

  <section class="card">
    <h2>简要摘要</h2>
    <p>{_esc(executive)}</p>
  </section>

  {f'''<section class="card">
    <h2>详细总结</h2>
    <pre>{_esc(detailed)}</pre>
  </section>''' if detailed else ''}

  {f'''<section class="card">
    <h2>关键指标与阈值</h2>
    <table class="metrics">
      <thead><tr><th>指标</th><th>实际值</th><th>阈值</th><th>说明</th></tr></thead>
      <tbody>{metrics_rows}</tbody>
    </table>
  </section>''' if metrics_rows else ''}

  {f'''<section class="card">
    <h2>判定逻辑链</h2>
    {decision_rows}
  </section>''' if decision_rows else ''}

  <section class="card">
    <h2>估值测算</h2>
    <pre>{_esc(valuation)}</pre>
  </section>

  <div class="cols">
    <section class="card">
      <h2>优势</h2>
      <ul>{_list_items(strengths)}</ul>
    </section>
    <section class="card">
      <h2>风险 / 短板</h2>
      <ul>{_list_items(weaknesses, '无重大项')}</ul>
    </section>
  </div>

  <section class="card">
    <h2>分层解读</h2>
    {layer_rows or '<p>暂无分层数据</p>'}
  </section>

  <footer>研究辅助，不构成投资建议。买卖结论以 LCAI 规则为准。</footer>
</body>
</html>"""


def write_report_html(out_dir: Path, symbol: str, lcai: dict, unified: dict) -> Path:
    html_text = build_report_html(symbol, lcai, unified)
    path = out_dir / "index.html"
    path.write_text(html_text, encoding="utf-8")
    return path


def rebuild_from_disk(symbol: str, root: Path | None = None) -> Path:
    root = root or Path(__file__).resolve().parents[1]
    out_dir = root / "reports" / symbol
    lcai = json.loads((out_dir / "lcai.json").read_text(encoding="utf-8"))
    unified = json.loads((out_dir / "unified.json").read_text(encoding="utf-8"))
    return write_report_html(out_dir, symbol, lcai, unified)


if __name__ == "__main__":
    import sys

    root = Path(__file__).resolve().parents[1]
    syms = sys.argv[1:] if len(sys.argv) > 1 else []
    if not syms:
        wl = root / "watchlist-data.js"
        if wl.exists():
            import re

            syms = re.findall(r'"(\d{5,6})"', wl.read_text(encoding="utf-8"))
    for s in syms:
        p = rebuild_from_disk(s, root)
        print(f"Wrote {p}")
