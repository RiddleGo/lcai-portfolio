#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 lcai + unified 生成 reports/{symbol}/index.html（UZI 未就绪时也展示完整 LCAI 研判）。"""
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
    *,
    uzi_html_embedded: bool = False,
) -> str:
    compare = compare or {}
    name = lcai.get("name") or unified.get("name") or symbol
    verdict = lcai.get("verdict") or (unified.get("verdict") or {}).get("value") or "—"
    action = lcai.get("verdict_action") or (unified.get("verdict") or {}).get("action") or "—"
    rating = lcai.get("rating") or (unified.get("verdict") or {}).get("rating") or "—"
    score = lcai.get("overall_score") or (unified.get("verdict") or {}).get("score") or "—"
    executive = unified.get("executive") or compare.get("executive") or ""
    valuation = (unified.get("valuation") or {}).get("narrative") or ""
    uzi = unified.get("uzi") or {}
    uzi_ready = bool(uzi.get("ready"))
    generated = unified.get("generated_at") or compare.get("generated_at") or ""
    layers = unified.get("layers") or []
    strengths = unified.get("strengths") or []
    weaknesses = unified.get("weaknesses") or []

    layer_rows = ""
    for layer in layers:
        st = layer.get("lcai_status") or "—"
        st_cls = "ok" if st == "通过" else "bad" if st == "未通过" else "warn"
        layer_rows += f"""
        <section class="layer">
          <h3>{_esc(layer.get('title') or layer.get('layer'))} <span class="tag {st_cls}">{_esc(st)}</span></h3>
          <p>{_esc(layer.get('merged_summary') or layer.get('lcai_summary') or '')}</p>
          {f'<p class="uzi-note"><strong>UZI：</strong>{_esc(layer.get("uzi_insight"))}</p>' if layer.get('uzi_insight') else ''}
        </section>"""

    uzi_block = ""
    if uzi_ready:
        uzi_block = f"""
        <section class="card">
          <h2>UZI 价值派参考</h2>
          <p>定调：{_esc(uzi.get('tone'))} · 共识 {_esc(uzi.get('consensus'))}</p>
        </section>"""
    else:
        uzi_block = """
        <section class="card muted">
          <h2>UZI 价值派参考</h2>
          <p>尚未生成。持仓/云端关注列表每周一 Actions 自动补全；新票首次收藏需 Submit 一次入队。</p>
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
    .uzi-note {{ font-size: 0.88rem; color: #94a3b8; }}
    footer {{ margin-top: 24px; font-size: 0.8rem; color: #64748b; }}
    pre {{ white-space: pre-wrap; font-family: inherit; margin: 0; }}
  </style>
</head>
<body>
  <p><a href="{dash_url}">← 返回资产总览 · 选股</a></p>
  <h1>{_esc(name)} <span style="font-weight:400;color:#94a3b8">({symbol})</span></h1>
  <p class="meta">评级 {_esc(rating)} · 总分 {_esc(score)}{f' · 更新 {_esc(generated)}' if generated else ''}</p>
  <p class="verdict {'buy' if verdict == '买入' else 'hold' if verdict in ('观察', '持有') else ''}">{_esc(verdict)} — {_esc(action)}</p>

  <section class="card">
    <h2>Executive Summary</h2>
    <p>{_esc(executive)}</p>
  </section>

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

  {uzi_block}

  <footer>研究辅助，不构成投资建议。买卖结论以 LCAI 规则为准。
  {f'<br>本页含 UZI 原始 HTML 嵌入。' if uzi_html_embedded else ''}</footer>
</body>
</html>"""


def write_report_html(out_dir: Path, symbol: str, lcai: dict, unified: dict, compare: dict | None = None) -> Path:
    html_text = build_report_html(symbol, lcai, unified, compare)
    path = out_dir / "index.html"
    path.write_text(html_text, encoding="utf-8")
    return path


def rebuild_from_disk(symbol: str, root: Path | None = None) -> Path:
    root = root or Path(__file__).resolve().parents[1]
    out_dir = root / "reports" / symbol
    lcai = json.loads((out_dir / "lcai.json").read_text(encoding="utf-8"))
    unified = json.loads((out_dir / "unified.json").read_text(encoding="utf-8"))
    compare_path = out_dir / "lcai-vs-uzi.json"
    compare = json.loads(compare_path.read_text(encoding="utf-8")) if compare_path.exists() else {}
    return write_report_html(out_dir, symbol, lcai, unified, compare)


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
