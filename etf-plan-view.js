(function () {
  "use strict";

  const LS_KEY = "lcai-etf-done-local";

  function fmtMoney(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString("zh-CN", { maximumFractionDigits: 0 }) + " 元";
  }

  function fmtPct(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const v = Number(n);
    const cls = v > 0 ? "gain" : v < 0 ? "loss" : "";
    return `<span class="${cls}">${v > 0 ? "+" : ""}${v.toFixed(2)}%</span>`;
  }

  function loadLocalDone() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalDone(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  function notifyIfNeeded(data) {
    if (!data?.buySignals?.length) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("ETF 加仓提醒", { body: data.summary });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted") new Notification("ETF 加仓提醒", { body: data.summary });
      });
    }
  }

  function renderAlertBanner(el, data) {
    const level = data.alertLevel || "none";
    const cls =
      level === "buy" ? "etf-alert-buy" : level === "info" ? "etf-alert-info" : "etf-alert-wait";
    el.className = "etf-alert " + cls;
    el.innerHTML = `
      <div class="etf-alert-title">${level === "buy" ? "今日建议加仓" : level === "info" ? "待执行" : "继续观察"}</div>
      <div class="etf-alert-body">${data.summary || "—"}</div>
      ${data.cashFlowNote ? `<div class="etf-alert-note">⚠ ${data.cashFlowNote}</div>` : ""}
      <div class="etf-alert-meta">检测 ${data.checkedDate || "—"} · 更新 ${(data.updatedAt || "").slice(0, 16)}</div>
    `;
  }

  function renderBuySignals(container, signals) {
    if (!signals?.length) {
      container.innerHTML = '<p class="page-desc">今日暂无符合计划的加仓项。</p>';
      return;
    }
    container.innerHTML = signals
      .map(
        s => `
      <div class="etf-signal-card">
        <div class="etf-signal-head">
          <strong>${s.code}</strong> ${s.name}
          <span class="etf-tag etf-tag-buy">建议 ${fmtMoney(s.plannedAmount)}</span>
        </div>
        <div class="etf-signal-grid">
          <span>现价 ${s.price ?? "—"}</span>
          <span>20日高 ${s.highNDays ?? "—"}</span>
          <span>回落 ${s.drawdownPct != null ? s.drawdownPct + "%" : "—"}</span>
          <span>触发价 ${s.triggerPrice ?? "—"}</span>
        </div>
        <ul class="etf-reasons">${(s.reasons || []).map(r => `<li>${r}</li>`).join("")}</ul>
        <button type="button" class="screen-btn etf-mark-btn" data-code="${s.code}" data-amt="${s.plannedAmount}">本机标记已买入</button>
      </div>`
      )
      .join("");
  }

  function renderTargets(container, targets) {
    container.innerHTML = `
      <table>
        <thead>
          <tr><th>代码</th><th>名称</th><th>进度</th><th>现价</th><th>涨跌</th><th>20日回落</th></tr>
        </thead>
        <tbody>
          ${(targets || [])
            .filter(t => t.code !== "CASH")
            .map(
              t => `
            <tr>
              <td>${t.code}</td>
              <td>${t.name}</td>
              <td>${fmtMoney(t.investedAmount)} / ${fmtMoney(t.targetAmount)} (${t.progressPct}%)</td>
              <td>${t.price ?? "—"}</td>
              <td>${fmtPct(t.changePct)}</td>
              <td>${t.drawdownPct != null ? t.drawdownPct + "%" : "—"}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderBatch(container, batches) {
    const active = (batches || []).find(b => b.status === "active");
    if (!active) {
      container.innerHTML = '<p class="page-desc">当前无活跃批次，可能已全部完成。</p>';
      return;
    }
    container.innerHTML = `
      <h3>${active.name} <span class="etf-tag">${active.id}</span></h3>
      <p class="page-desc">${active.note || ""}${active.deadline ? " · 截止 " + active.deadline : ""}</p>
      <table>
        <thead><tr><th>信号</th><th>代码</th><th>计划金额</th><th>说明</th></tr></thead>
        <tbody>
          ${(active.orders || [])
            .map(o => {
              const sig =
                o.signal === "buy"
                  ? '<span class="etf-tag etf-tag-buy">加仓</span>'
                  : o.signal === "done"
                    ? '<span class="etf-tag etf-tag-done">完成</span>'
                    : '<span class="etf-tag">等待</span>';
              return `<tr>
                <td>${sig}</td>
                <td>${o.code}</td>
                <td>${fmtMoney(o.plannedAmount)}</td>
                <td>${(o.reasons || []).join("；")}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  function renderHomeWidget(data) {
    const el = document.getElementById("home-etf-summary");
    if (!el || !data) return;
    const n = (data.buySignals || []).length;
    el.innerHTML =
      n > 0
        ? `<span class="val gain">${n} 项待加仓</span>`
        : `<span class="val">${data.alertLevel === "info" ? "待执行" : "观望"}</span>`;
    const sub = document.getElementById("home-etf-sub");
    if (sub) sub.textContent = (data.summary || "").slice(0, 40);
  }

  function bindMarkButtons(root) {
    root.querySelectorAll(".etf-mark-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code;
        const amt = Number(btn.dataset.amt);
        const list = loadLocalDone();
        list.push({ code, amount: amt, date: new Date().toISOString().slice(0, 10) });
        saveLocalDone(list);
        btn.textContent = "已标记（本机）";
        btn.disabled = true;
      });
    });
  }

  function render() {
    const data = window.ETF_PLAN;
    const banner = document.getElementById("etf-alert-banner");
    if (!data || !banner) return;

    renderAlertBanner(banner, data);
    renderBuySignals(document.getElementById("etf-buy-signals"), data.buySignals);
    renderTargets(document.getElementById("etf-targets-wrap"), data.targets);
    renderBatch(document.getElementById("etf-batch-wrap"), data.batches);
    renderHomeWidget(data);

    const local = loadLocalDone();
    const localEl = document.getElementById("etf-local-done");
    if (localEl) {
      localEl.innerHTML = local.length
        ? local.map(x => `<li>${x.date} ${x.code} ${fmtMoney(x.amount)}（本机记录，请同步到仓库 state）</li>`).join("")
        : "<li>暂无本机记录。买入后运行：<code>python scripts/check_etf_plan.py --done 588000 10000</code></li>";
    }

    bindMarkButtons(document.getElementById("page-etf") || document);
    notifyIfNeeded(data);
  }

  window.EtfPlanView = { render, loadLocalDone };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
