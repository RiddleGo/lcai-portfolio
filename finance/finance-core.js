/**
 * 财务计划核心 — 还债/执行/持仓/规划
 * 配置：finance-config-data.js → window.FINANCE_CONFIG
 */
(function (global) {
  "use strict";

  function cfg() { return global.FINANCE_CONFIG || {}; }
  function C(k) { return (cfg().constants || {})[k]; }


    const TODO_STORAGE_KEY = cfg().todoStorageKey || "lcai-exec-todos-v9";
        const TODO_STORAGE_KEY_V2 = "lcai-exec-todos-v2";
    const TODO_STORAGE_KEY_V3 = "lcai-exec-todos-v3";
    const TODO_STORAGE_KEY_V4 = "lcai-exec-todos-v4";
    const TODO_STORAGE_KEY_V5 = "lcai-exec-todos-v5";
    const TODO_STORAGE_KEY_V6 = "lcai-exec-todos-v6";
    const JD_PREPAY_AMOUNT = C("jdPrepayAmount");
    const JD_DEBT_TOTAL = C("jdDebtTotal");
    const DY_DEBT_TOTAL = C("dyDebtTotal");
    const DY_CLEAR_AMOUNT = C("dyClearAmount");
    const HB_CASH_BEFORE_DY_CLEAR = C("hbCashBeforeDyClear");
    const DY_RATE_ANNUAL = C("dyRateAnnual");
    const DY_LOAN_DATE = C("dyLoanDate");
    const DY_MONTHLY = C("dyMonthly");
    const JUL_JD_PAY = C("julJdPay");
    const FUND_TOTAL = C("fundTotal");
    const WEIMOB_JUL_EST = C("weimobJulEst");
    const TENCENT_AUG_EST = C("tencentAugEst");
    const PINGAN_AUG_SELL = C("pinganAugSell");
    const PINGAN_AUG_EST = C("pinganAugEst");
    const MONTHLY_SAVINGS = C("monthlySavings");
    const JD_HEALTH_SHARES = C("jdHealthShares");
    const BASELINE_TODO_DONE = cfg().baselineTodoDone || {};
    const OVERRIDES_KEY = cfg().overridesKey || "lcai-portfolio-overrides";

    const BASELINE = (function () {
      const b = cfg().baseline || {};
      return {
        debts: b.debts || {},
        debtCounts: b.debtCounts || {},
        holdings: (global.LCAI_HOLDINGS && global.LCAI_HOLDINGS.holdings) || [],
        funds: b.funds || [],
        accountCash: b.accountCash || { gt: 0, hb: 0 },
        accountCashReserve: b.accountCashReserve || {},
      };
    })();

    const TODO_GROUPS = cfg().todoGroups || [];

    const MONTH_TODO_MAP = cfg().monthTodoMap || {};

    const months = cfg().months || [];

    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    function fmtInt(n) {
      return Math.round(n).toLocaleString("zh-CN");
    }

    function fmtMoney(n, decimals) {
      return n.toLocaleString("zh-CN", { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0 });
    }

    function fmtTable(v) {
      if (v == null) return '<span class="dash">—</span>';
      return v.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getMonthRow(label) {
      return months.find(m => m.label === label);
    }

    function getDataUpdatedAt() {
      const parts = [];
      const q = getQuotes().updatedAt;
      const h = window.LCAI_HOLDINGS?.updatedAt;
      if (q) parts.push(new Date(q));
      if (h) parts.push(new Date(h + "T12:00:00"));
      if (!parts.length) return null;
      parts.sort((a, b) => b - a);
      return parts[0].toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
    }

    function updatePageDates() {
      const stamp = getDataUpdatedAt();
      const suffix = stamp ? ` · 数据 ${stamp}` : "";
      const footer = document.getElementById("site-footer");
      if (footer) footer.textContent = `LCAI 资产总览工作台${suffix}`;
      ["page-desc-plan", "page-desc-debt", "page-desc-policy"].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.base) el.dataset.base = el.textContent.replace(/\s·\s数据.*$/, "");
        if (el) el.textContent = (el.dataset.base || el.textContent) + suffix;
      });
    }

    function accountStats(state, acct) {
      const mv = state.holdings.filter(h => !h.sold && h.account === acct)
        .reduce((a, h) => a + h.marketValue, 0);
      const grossCash = BASELINE.accountCash[acct] || 0;
      const reserve = (BASELINE.accountCashReserve && BASELINE.accountCashReserve[acct]) || 0;
      const cash = Math.max(0, grossCash - reserve);
      const total = mv + grossCash;
      const posPct = total > 0 ? (mv / total) * 100 : 0;
      return { mv, cash, grossCash, reserve, total, posPct };
    }

    function pendingMonthTotal(row, todoState, monthKey) {
      if (!row) return 0;
      const ids = MONTH_TODO_MAP[monthKey] || [];
      let sum = 0;
      ids.forEach(id => {
        if (isTodoDone(todoState, id)) return;
        const item = getTodoItemById(id);
        if (item?.defaultAmount) sum += item.defaultAmount;
      });
      return sum;
    }

    function renderPlanSummary(todoState) {
      const junRow = getMonthRow("2026-06");
      const julRow = getMonthRow("2026-07");
      const augRow = getMonthRow("2026-08");
      const junPending = pendingMonthTotal(junRow, todoState, "2026-06");
      const julTotal = julRow ? ceilSum(julRow) : 0;
      const augTotal = augRow ? ceilSum(augRow) : 0;
      const augPlatform = (augRow?.jd || 0) + (augRow?.ali || 0);

      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      set("plan-sum-jun-val", junPending > 0 ? fmtInt(junPending) : "0");
      set("plan-sum-jun-sub", junPending > 0 ? "支付宝 6/22 前" : "6 月待办已全部完成");
      set("plan-sum-jul-val", fmtInt(julTotal));
      set("plan-sum-jul-sub", `卖微盟 ~${fmtInt(WEIMOB_JUL_EST)} · 京东 7/4 + 支付宝 7/22 · 抖音已清`);
      set("plan-sum-aug-val", fmtInt(augTotal));
      set("plan-sum-aug-sub", `赎基金 + 卖腾讯 + 卖平安 ~${PINGAN_AUG_SELL.toLocaleString()} 股`);

      set("plan-rhythm-jul4", `7/3 前卖微盟 · 7/4 还京东 ${fmtInt(JUL_JD_PAY)}`);
      set("plan-cash-jul-note", `7/22 支付宝 ${fmtInt(julRow?.ali || 0)} · 配合 7 月工资 ${fmtInt(MONTHLY_SAVINGS)}`);
      set("plan-cash-aug-start", `需备 ~${fmtInt(augTotal)}（朋友 + 平台）`);
      set("plan-cash-aug-note", `基金 ~${fmtInt(FUND_TOTAL)} + 腾讯 ~${fmtInt(TENCENT_AUG_EST)} + 平安 ~${fmtInt(PINGAN_AUG_EST)} + 8 月工资`);
    }

    function getNextUrgentTodo(todoState) {
      const order = Object.keys(MONTH_TODO_MAP);
      for (const month of order) {
        for (const id of MONTH_TODO_MAP[month]) {
          if (!isTodoDone(todoState, id)) {
            return { id, month, item: getTodoItemById(id) };
          }
        }
      }
      return null;
    }

    function daysUntilJuly4() {
      const now = new Date();
      const y = now.getFullYear();
      let target = new Date(y, 6, 4);
      if (now > target) target = new Date(y + 1, 6, 4);
      return Math.ceil((target - now) / 86400000);
    }

    function ceilSum(row) {
      return Math.ceil(
        [row.jd, row.didi, row.dy, row.ali, row.personal].filter(v => v != null).reduce((a, b) => a + b, 0)
      );
    }

    function getTodoEntry(state, id) {
      const v = state[id];
      if (!v) return { done: false, actual: null, actualPrice: null };
      if (typeof v === "boolean") return { done: v, actual: null, actualPrice: null };
      return {
        done: !!v.done,
        actual: v.actual != null ? Number(v.actual) : null,
        actualPrice: v.actualPrice != null ? Number(v.actualPrice) : null,
      };
    }

    function isTodoDone(state, id) {
      return getTodoEntry(state, id).done;
    }

    function loadTodoState() {
      try {
        let raw = localStorage.getItem(TODO_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
        for (const key of [TODO_STORAGE_KEY_V6, TODO_STORAGE_KEY_V5, TODO_STORAGE_KEY_V4, TODO_STORAGE_KEY_V3, TODO_STORAGE_KEY_V2, TODO_STORAGE_KEY_V1]) {
          const prev = localStorage.getItem(key);
          if (!prev) continue;
          const parsed = JSON.parse(prev);
          const merged = { ...BASELINE_TODO_DONE };
          for (const [k, v] of Object.entries(parsed)) {
            merged[k] = typeof v === "boolean" ? { done: v } : v;
          }
          saveTodoState(merged);
          return merged;
        }
        saveTodoState(BASELINE_TODO_DONE);
        return { ...BASELINE_TODO_DONE };
      } catch {
        return { ...BASELINE_TODO_DONE };
      }
    }

    function saveTodoState(state) {
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state));
      if (global.LifeSync && global.LifeSync.syncFinanceTodo) {
        global.LifeSync.syncFinanceTodo(state);
      }
    }

    function loadOverrides() {
      try {
        const raw = localStorage.getItem(OVERRIDES_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function saveOverrides(o) {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
      if (global.LifeSync && global.LifeSync.syncFinanceOverrides) {
        global.LifeSync.syncFinanceOverrides(o);
      }
    }

    function normalizeOverrides(o) {
      const out = o && typeof o === "object" ? o : {};
      if (!Array.isArray(out.deposits)) out.deposits = [];
      if (!Array.isArray(out.newHoldings)) out.newHoldings = [];
      if (!out.holdings || typeof out.holdings !== "object") out.holdings = {};
      return out;
    }

    function loadOverridesNormalized() {
      return normalizeOverrides(loadOverrides());
    }

    function codeDigits(input) {
      return String(input || "").replace(/\D/g, "");
    }

    function buildSymbol(code, market) {
      const c = codeDigits(code);
      if (!c) return "";
      if (market === "hk") return "116." + c.padStart(5, "0");
      if (market === "sh" || c.startsWith("6")) return "1." + c.padStart(6, "0");
      return "0." + c.padStart(6, "0");
    }

    function findHoldingDef(id, overrides) {
      const base = BASELINE.holdings.find(x => x.id === id);
      if (base) return base;
      return (overrides.newHoldings || []).find(x => x.id === id);
    }

    function sumDeposits(deposits) {
      return (deposits || []).reduce((a, d) => a + (Number(d.amount) || 0), 0);
    }

    function applyDepositsToAccounts(accounts, deposits) {
      for (const d of deposits || []) {
        const amt = Number(d.amount) || 0;
        if (d.account === "gt") accounts.gt += amt;
        else if (d.account === "hb") accounts.hb += amt;
        else accounts.pool = (accounts.pool || 0) + amt;
      }
    }

    function mergeNewHoldings(s, overrides) {
      for (const h of overrides.newHoldings || []) {
        if (!h || h.sold) continue;
        if (s.holdings.some(x => x.id === h.id)) continue;
        s.holdings.push(deepClone(h));
      }
    }

    function getQuotes() {
      return window.LCAI_QUOTES || { fx: { HKDCNY: 0.92 }, prices: {}, updatedAt: null };
    }

    function getFxRate(overrides) {
      if (overrides?.fxHKDCNY != null && !isNaN(overrides.fxHKDCNY)) return overrides.fxHKDCNY;
      return getQuotes().fx?.HKDCNY ?? 0.92;
    }

    function getNativePrice(h, overrides) {
      const ov = overrides?.holdings?.[h.id];
      if (ov?.manualPrice != null && !isNaN(ov.manualPrice)) {
        return { price: ov.manualPrice, source: "manual" };
      }
      const q = getQuotes().prices?.[h.symbol];
      if (q?.price != null) {
        return { price: q.price, source: q.fallback ? "fallback" : "quote", changePct: q.changePct };
      }
      return { price: h.fallbackPrice, source: "baseline" };
    }

    function applyOverridesToState(s, overrides) {
      for (const h of s.holdings) {
        const ov = overrides?.holdings?.[h.id];
        if (ov?.costPerShare != null && !isNaN(ov.costPerShare)) h.costPerShare = ov.costPerShare;
      }
    }

    function applyQuotes(s, overrides) {
      const fx = getFxRate(overrides);
      s.fxRate = fx;
      for (const h of s.holdings) {
        if (h.sold) {
          h.marketValue = 0;
          h.pnl = 0;
          h.pnlPct = 0;
          continue;
        }
        const { price, source, changePct } = getNativePrice(h, overrides);
        h.nativePrice = price;
        h.priceSource = source;
        h.changePct = changePct ?? null;
        const priceCNY = h.currency === "HKD" ? price * fx : price;
        h.marketValue = Math.round(h.shares * priceCNY);
        const costBasis = h.shares * h.costPerShare * (h.currency === "HKD" ? fx : 1);
        h.pnl = Math.round(h.marketValue - costBasis);
        h.pnlPct = costBasis > 0 ? Math.round((h.pnl / costBasis) * 1000) / 10 : 0;
      }
    }

    function getEffectAmount(item, entry, overrides) {
      if (entry.actual != null && !isNaN(entry.actual)) return entry.actual;
      if (entry.actualPrice != null && !isNaN(entry.actualPrice) && item.holdingId) {
        const overrides = loadOverridesNormalized();
        const h = findHoldingDef(item.holdingId, overrides) || BASELINE.holdings.find(x => x.id === item.holdingId);
        if (h) {
          const fx = getFxRate(overrides);
          const shares = item.sellShares ?? h.shares;
          const priceCNY = h.currency === "HKD" ? entry.actualPrice * fx : entry.actualPrice;
          return Math.round(shares * priceCNY);
        }
      }
      return item.defaultAmount ?? 0;
    }

    function findHolding(s, id) {
      return s.holdings.find(h => h.id === id && !h.sold);
    }

    function applyPartialSell(h, sellValue, defaultValue, sellShares) {
      let toSell = sellShares ?? h.shares;
      if (defaultValue && sellValue && Math.abs(sellValue - defaultValue) > 0.01) {
        toSell = Math.round(toSell * (sellValue / defaultValue));
      }
      h.shares = Math.max(0, h.shares - toSell);
      if (h.shares <= 0) h.sold = true;
    }

    function applyEffect(s, item, amount, entry) {
      switch (item.effect) {
        case "sell_all": {
          const h = findHolding(s, item.holdingId);
          if (h) h.sold = true;
          break;
        }
        case "sell_partial": {
          const h = findHolding(s, item.holdingId);
          if (!h) break;
          if (entry?.actualPrice != null && item.sellShares) {
            h.shares = Math.max(0, h.shares - item.sellShares);
            if (h.shares <= 0) h.sold = true;
          } else {
            applyPartialSell(h, amount, item.defaultAmount, item.sellShares);
          }
          break;
        }
        case "debt_clear":
          s.debts[item.platform] = 0;
          break;
        case "debt_pay": {
          const scale = item.defaultAmount ? amount / item.defaultAmount : 1;
          for (const [plat, val] of Object.entries(item.pay)) {
            s.debts[plat] = Math.max(0, s.debts[plat] - val * scale);
          }
          break;
        }
        case "fund_redeem_all":
          s.funds.forEach(f => { f.redeemed = true; f.amount = 0; f.pnl = 0; });
          break;
      }
    }

    function computeState(todoState) {
      const overrides = loadOverridesNormalized();
      const s = {
        debts: deepClone(BASELINE.debts),
        holdings: deepClone(BASELINE.holdings),
        funds: deepClone(BASELINE.funds),
      };
      mergeNewHoldings(s, overrides);
      applyOverridesToState(s, overrides);
      for (const group of TODO_GROUPS) {
        for (const item of group.items) {
          if (!item.effect) continue;
          const entry = getTodoEntry(todoState, item.id);
          if (!entry.done) continue;
          applyEffect(s, item, getEffectAmount(item, entry, overrides), entry);
        }
      }
      applyQuotes(s, overrides);
      const activeHoldings = s.holdings.filter(h => !h.sold);
      s.stockPnl = activeHoldings.reduce((a, h) => a + h.pnl, 0);
      const activeFunds = s.funds.filter(f => !f.redeemed);
      s.fundsTotal = activeFunds.reduce((a, f) => a + f.amount, 0);
      s.fundPnl = activeFunds.reduce((a, f) => a + f.pnl, 0);
      s.liabilitiesTotal = Object.values(s.debts).reduce((a, b) => a + b, 0);
      s.accounts = { gt: 0, hb: 0, pool: 0 };
      activeHoldings.forEach(h => { s.accounts[h.account] += h.marketValue; });
      s.accounts.gt += BASELINE.accountCash.gt;
      s.accounts.hb += BASELINE.accountCash.hb;
      s.deposits = overrides.deposits || [];
      s.extraCash = sumDeposits(s.deposits);
      applyDepositsToAccounts(s.accounts, s.deposits);
      s.securitiesTotal = s.accounts.gt + s.accounts.hb;
      s.netWorth = s.securitiesTotal + s.fundsTotal + s.extraCash - s.liabilitiesTotal;
      s.floatingLoss = s.stockPnl + s.fundPnl;
      const assets = s.securitiesTotal + s.fundsTotal + s.extraCash;
      s.debtRatio = assets > 0 ? (s.liabilitiesTotal / assets) * 100 : 0;
      s.localHoldings = activeHoldings.filter(h => h.local);
      return s;
    }

    function renderDebts(state) {
      const map = [
        ["jd", "debt-jd", "card-debt-jd"],
        ["ali", "debt-ali", "card-debt-ali"],
        ["dy", "debt-dy", "card-debt-dy"],
        ["didi", "debt-didi", "card-debt-didi"],
        ["personal", "debt-personal", "card-debt-personal"],
      ];
      map.forEach(([key, elId, cardId]) => {
        const val = state.debts[key];
        const el = document.getElementById(elId);
        const card = document.getElementById(cardId);
        if (el) el.textContent = fmtInt(val);
        if (card) {
          card.classList.toggle("data-done", val < 1);
          card.classList.toggle("card-debt-cleared", val < 1);
        }
      });
      const totalEl = document.getElementById("debt-total");
      if (totalEl) totalEl.textContent = fmtInt(state.liabilitiesTotal);

      const cleared = ["dy", "didi"].filter(k => state.debts[k] < 1);
      const tipsEl = document.querySelector("#page-debt .tips ul");
      if (tipsEl && tipsEl.dataset.dynamic !== "1") {
        tipsEl.dataset.dynamic = "1";
      }
      if (tipsEl) {
        const first = tipsEl.querySelector("li");
        if (first) {
          const clearedNote = cleared.length ? `${cleared.map(k => ({ dy: "抖音", didi: "滴滴" }[k])).join("、")}已结清 · ` : "";
          first.textContent = `${clearedNote}京东金条 ~${fmtInt(state.debts.jd)}（${BASELINE.debtCounts.jd} 笔）。7/4 当期 ~${fmtInt(JUL_JD_PAY)}；7 月合计 ~${fmtInt(ceilSum(getMonthRow("2026-07")))}。`;
        }
      }

      const labels = {
        jd: ["京东金条", "jd", String(BASELINE.debtCounts.jd), "每月 4 日"],
        ali: ["支付宝", "ali", String(BASELINE.debtCounts.ali), "每月 22 日"],
        dy: ["抖音", "dy", String(BASELINE.debtCounts.dy), "6/19 已结清"],
        didi: ["滴滴", "didi", String(BASELINE.debtCounts.didi), "已结清"],
        personal: ["个人借款", "personal", String(BASELINE.debtCounts.personal), "2026 年 8 月"],
      };
      const tbody = document.getElementById("debt-detail-tbody");
      if (!tbody) return;
      tbody.innerHTML = Object.keys(labels).map(key => {
        const val = state.debts[key];
        if (val < 1 && (key === "dy" || key === "didi")) return "";
        const [name, dot, count, due] = labels[key];
        const doneCls = val < 1 ? " class=\"data-done\"" : "";
        return `<tr${doneCls}><td><span class="dot ${dot}"></span> ${name}</td><td>${count}</td><td>${fmtMoney(val, 2)}</td><td>${due}</td></tr>`;
      }).join("");
    }

    function renderHoldings(state) {
      const active = state.holdings.filter(h => !h.sold);
      const holdTotal = active.reduce((a, h) => a + h.marketValue, 0) || 1;
      const acctGt = document.getElementById("acct-gt");
      const acctHb = document.getElementById("acct-hb");
      const secTotal = document.getElementById("sec-total");
      const secPnl = document.getElementById("sec-pnl");
      const secCost = document.getElementById("sec-cost");
      const netWorth = document.getElementById("net-worth");
      const netSub = document.getElementById("net-worth-sub");

      if (acctGt) acctGt.textContent = fmtInt(state.accounts.gt);
      if (acctHb) acctHb.textContent = fmtInt(state.accounts.hb);
      const gtS = accountStats(state, "gt");
      const hbS = accountStats(state, "hb");
      const gtSub = document.getElementById("acct-gt-sub");
      const hbSub = document.getElementById("acct-hb-sub");
      const secCashSub = document.getElementById("sec-cash-sub");
      if (gtSub) gtSub.textContent = `仓位 ${gtS.posPct.toFixed(1)}% · 可用 ${fmtInt(gtS.cash)}`;
      if (hbSub) {
        const hbCashNote = hbS.reserve > 0
          ? `可用 ${fmtInt(hbS.cash)}（扣抖音 ${fmtInt(hbS.reserve)}）`
          : `可用 ${fmtInt(hbS.cash)}`;
        hbSub.textContent = `仓位 ${hbS.posPct.toFixed(1)}% · ${hbCashNote}`;
      }
      if (secCashSub) {
        const hbReserve = hbS.reserve > 0 ? ` · 华宝扣抖音 ${fmtInt(hbS.reserve)} 预留` : "";
        secCashSub.textContent = `可用现金 ${fmtInt(gtS.cash + hbS.cash)}${hbReserve} · 含两账户`;
      }
      if (secTotal) secTotal.textContent = fmtInt(state.securitiesTotal);
      if (secPnl) {
        secPnl.textContent = (state.stockPnl >= 0 ? "+" : "") + fmtInt(state.stockPnl);
        secPnl.className = state.stockPnl >= 0 ? "card-value gain" : "card-value loss";
      }
      if (secCost) secCost.textContent = fmtInt(state.securitiesTotal + Math.abs(state.stockPnl));
      if (netWorth) netWorth.textContent = fmtInt(state.netWorth);
      const cashPart = state.extraCash > 0 ? ` + 额外现金 ${fmtInt(state.extraCash)}` : "";
      if (netSub) netSub.textContent = `证券 ${fmtInt(state.securitiesTotal)} + 基金 ${fmtInt(state.fundsTotal)}${cashPart} − 负债 ${fmtInt(state.liabilitiesTotal)}`;

      const tbody = document.getElementById("holdings-tbody");
      if (tbody) {
        if (active.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted)">暂无持仓</td></tr>';
        } else {
          tbody.innerHTML = active.map(h => {
            const pct = (h.marketValue / holdTotal * 100).toFixed(1);
            const pnlCls = h.pnl >= 0 ? "gain" : "loss";
            const pnlSign = h.pnl >= 0 ? "+" : "";
            const hk = h.hk ? '<span class="badge hk">HK</span>' : "";
            const local = h.local ? '<span class="badge local">网页</span>' : "";
            const acct = h.account === "gt" ? "gt" : "hb";
            const cur = h.currency === "HKD" ? "HKD" : "CNY";
            const priceLabel = h.priceSource === "manual"
              ? `<span class="price-manual">${fmtMoney(h.nativePrice, 2)} ${cur}*</span>`
              : `${fmtMoney(h.nativePrice, 2)} ${cur}`;
            const manualBtn = h.priceSource === "manual"
              ? `<button type="button" data-clear-price="${h.id}">恢复自动</button>`
              : "";
            const removeBtn = h.local
              ? `<button type="button" data-remove-local="${h.id}">删除</button>`
              : "";
            return `<tr>
              <td>${h.name}${hk}${local}</td>
              <td><span class="account-tag ${acct}">${acct === "gt" ? "国投" : "华宝"}</span></td>
              <td>${h.shares.toLocaleString()}</td>
              <td>${fmtMoney(h.costPerShare, 2)} ${cur}</td>
              <td>${priceLabel}</td>
              <td>${fmtInt(h.marketValue)}</td>
              <td class="${pnlCls}">${pnlSign}${fmtInt(h.pnl)} (${pnlSign}${h.pnlPct}%)</td>
              <td>${pct}%</td>
              <td><div class="holding-actions">
                <button type="button" data-edit-cost="${h.id}">改成本</button>
                <button type="button" data-edit-price="${h.id}">改现价</button>
                ${manualBtn}
                ${removeBtn}
              </div></td>
            </tr>`;
          }).join("");
        }
        tbody.querySelectorAll("[data-edit-cost]").forEach(btn => {
          btn.addEventListener("click", () => editHoldingCost(btn.dataset.editCost));
        });
        tbody.querySelectorAll("[data-edit-price]").forEach(btn => {
          btn.addEventListener("click", () => editHoldingPrice(btn.dataset.editPrice));
        });
        tbody.querySelectorAll("[data-clear-price]").forEach(btn => {
          btn.addEventListener("click", () => clearHoldingPrice(btn.dataset.clearPrice));
        });
        tbody.querySelectorAll("[data-remove-local]").forEach(btn => {
          btn.addEventListener("click", () => removeLocalHolding(btn.dataset.removeLocal));
        });
      }
    }

    function renderQuoteBar() {
      const bar = document.getElementById("quote-bar");
      if (!bar) return;
      const q = getQuotes();
      const meta = bar.querySelector(".quote-bar-meta") || bar;
      const updatedAt = q.updatedAt;
      let stale = false;
      if (updatedAt) {
        const age = Date.now() - new Date(updatedAt).getTime();
        stale = age > 24 * 3600 * 1000;
      } else {
        stale = true;
      }
      bar.classList.toggle("stale", stale);
      const fx = q.fx?.HKDCNY ?? 0.92;
      const timeStr = updatedAt ? updatedAt.replace("T", " ").slice(0, 16) : "无行情文件";
      const staleHint = stale ? " · <span style='color:var(--warn)'>行情可能过期</span>" : "";
      const metaEl = bar.querySelector(".quote-bar-meta");
      if (metaEl) {
        metaEl.innerHTML = `行情更新：<strong>${timeStr}</strong> · HKD/CNY <strong>${fx}</strong>${staleHint}`;
      }
    }

    function editHoldingCost(id) {
      const ov = loadOverridesNormalized();
      const h = findHoldingDef(id, ov);
      if (!h) return;
      const cur = ov.holdings?.[id]?.costPerShare ?? h.costPerShare;
      const curLabel = h.currency === "HKD" ? "HKD" : "CNY";
      const input = prompt(`${h.name} 成本价（${curLabel}）：`, String(cur));
      if (input === null) return;
      const num = parseFloat(input.replace(/,/g, ""));
      if (isNaN(num) || num <= 0) { alert("请输入有效数字"); return; }
      ov.holdings = ov.holdings || {};
      ov.holdings[id] = { ...ov.holdings[id], costPerShare: num };
      saveOverrides(ov);
      renderAll();
    }

    function editHoldingPrice(id) {
      const ov = loadOverridesNormalized();
      const h = findHoldingDef(id, ov);
      if (!h) return;
      const state = computeState(loadTodoState());
      const live = state.holdings.find(x => x.id === id);
      const cur = ov.holdings?.[id]?.manualPrice ?? live?.nativePrice ?? h.fallbackPrice;
      const curLabel = h.currency === "HKD" ? "HKD" : "CNY";
      const input = prompt(`${h.name} 现价（${curLabel}，覆盖行情）：`, String(cur));
      if (input === null) return;
      const num = parseFloat(input.replace(/,/g, ""));
      if (isNaN(num) || num <= 0) { alert("请输入有效数字"); return; }
      ov.holdings = ov.holdings || {};
      ov.holdings[id] = { ...ov.holdings[id], manualPrice: num };
      saveOverrides(ov);
      renderAll();
    }

    function clearHoldingPrice(id) {
      const ov = loadOverridesNormalized();
      if (ov.holdings?.[id]) {
        delete ov.holdings[id].manualPrice;
        if (Object.keys(ov.holdings[id]).length === 0) delete ov.holdings[id];
      }
      saveOverrides(ov);
      renderAll();
    }

    function renderFunds(state) {
      const active = state.funds.filter(f => !f.redeemed);
      const fundTotal = document.getElementById("fund-total");
      const fundSub = document.getElementById("fund-sub");
      if (fundTotal) fundTotal.textContent = fmtInt(state.fundsTotal);
      if (fundSub) {
        const pnlStr = state.fundPnl >= 0 ? `+${fmtInt(state.fundPnl)}` : fmtInt(state.fundPnl);
        fundSub.innerHTML = active.length === 0
          ? "已全部赎回"
          : `持仓收益 ${pnlStr} · 8 月全赎计划`;
      }
      const tbody = document.getElementById("funds-tbody");
      if (!tbody) return;
      if (active.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">已赎回 · 无持仓</td></tr>';
      } else {
        tbody.innerHTML = active.map((f, i) => {
          const pnlCls = f.pnl >= 0 ? "gain" : "loss";
          const pnlSign = f.pnl >= 0 ? "+" : "−";
          return `<tr><td>${f.name}</td><td>${fmtInt(f.amount)}</td><td class="${pnlCls}">${pnlSign}${Math.abs(f.pnl).toLocaleString()}</td><td><span class="badge danger">${i + 1}</span></td><td>待赎回</td></tr>`;
        }).join("");
      }
    }

    function renderDiagnosis(state) {
      const nw = document.getElementById("diag-networth");
      const nwSub = document.getElementById("diag-networth-sub");
      const fl = document.getElementById("diag-floatloss");
      const flSub = document.getElementById("diag-floatloss-sub");
      const dr = document.getElementById("diag-debtratio");
      const drSub = document.getElementById("diag-debtratio-sub");
      if (nw) nw.textContent = fmtInt(state.netWorth);
      const cashPart = state.extraCash > 0 ? ` + 额外现金 ${fmtInt(state.extraCash)}` : "";
      if (nwSub) nwSub.textContent = `证券 ${fmtInt(state.securitiesTotal)} + 基金 ${fmtInt(state.fundsTotal)}${cashPart} − 负债 ${fmtInt(state.liabilitiesTotal)}`;
      if (fl) fl.textContent = fmtInt(state.floatingLoss);
      if (flSub) flSub.textContent = `证券 ${fmtInt(state.stockPnl)} + 基金 ${fmtInt(state.fundPnl)}`;
      if (dr) dr.textContent = state.debtRatio.toFixed(0) + "%";
      if (drSub) {
        drSub.textContent = state.debtRatio > 50 ? "高杠杆 · 继续降负债" : state.debtRatio > 20 ? "杠杆下降中" : "低杠杆";
      }
    }

    function renderAdjustments(state) {
      const depList = document.getElementById("adjust-deposits-list");
      const holdList = document.getElementById("adjust-holdings-list");
      const extraTotal = document.getElementById("extra-cash-total");
      const extraSub = document.getElementById("extra-cash-sub");
      const localCount = document.getElementById("local-holdings-count");
      const localSub = document.getElementById("local-holdings-sub");

      if (extraTotal) extraTotal.textContent = fmtInt(state.extraCash || 0);
      if (extraSub) {
        const n = (state.deposits || []).length;
        extraSub.textContent = n ? `共 ${n} 笔追加 · 计入净资产` : "尚无追加 · 点上方按钮记录";
      }
      const locals = state.localHoldings || [];
      const localMv = locals.reduce((a, h) => a + (h.marketValue || 0), 0);
      if (localCount) localCount.textContent = String(locals.length);
      if (localSub) {
        localSub.textContent = locals.length
          ? `市值约 ${fmtInt(localMv)} · 在持仓页管理`
          : "去「持仓」页网页开新仓";
      }

      if (depList) {
        const deps = state.deposits || [];
        depList.innerHTML = deps.length ? deps.map(d => {
          const acctLabel = d.account === "gt" ? "国投" : d.account === "hb" ? "华宝" : "现金池";
          const note = d.note ? ` · ${d.note}` : "";
          return `<div class="finance-adjust-item">
            <div><strong>+${fmtInt(d.amount)}</strong> 元 · ${acctLabel}<div class="meta">${d.date || ""}${note}</div></div>
            <button type="button" data-remove-deposit="${d.id}">删除</button>
          </div>`;
        }).join("") : '<p class="page-desc" style="margin:0;">暂无追加存款</p>';
        depList.querySelectorAll("[data-remove-deposit]").forEach(btn => {
          btn.addEventListener("click", () => removeDeposit(btn.dataset.removeDeposit));
        });
      }

      if (holdList) {
        holdList.innerHTML = locals.length ? locals.map(h => {
          const acct = h.account === "gt" ? "国投" : "华宝";
          const cur = h.currency === "HKD" ? "HKD" : "CNY";
          return `<div class="finance-adjust-item">
            <div><strong>${h.name}</strong> · ${h.shares.toLocaleString()} 股 · ${acct}<div class="meta">成本 ${fmtMoney(h.costPerShare, 2)} ${cur} · 市值 ${fmtInt(h.marketValue)}</div></div>
            <button type="button" data-remove-local-adjust="${h.id}">删除</button>
          </div>`;
        }).join("") : '<p class="page-desc" style="margin:0;">暂无网页录入的新仓</p>';
        holdList.querySelectorAll("[data-remove-local-adjust]").forEach(btn => {
          btn.addEventListener("click", () => removeLocalHolding(btn.dataset.removeLocalAdjust));
        });
      }
    }

    function openFinanceDepositModal() {
      const modal = document.getElementById("finance-deposit-modal");
      if (!modal) return;
      document.getElementById("deposit-amount").value = "";
      document.getElementById("deposit-note").value = "";
      document.getElementById("deposit-account").value = "pool";
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }

    function closeFinanceDepositModal() {
      const modal = document.getElementById("finance-deposit-modal");
      if (modal) modal.hidden = true;
      document.body.style.overflow = "";
    }

    function clearLocalHoldingForm() {
      ["local-holding-name", "local-holding-code", "local-holding-shares", "local-holding-cost", "local-holding-fallback"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const market = document.getElementById("local-holding-market");
      const account = document.getElementById("local-holding-account");
      if (market) market.value = "sh";
      if (account) account.value = "hb";
    }

    function goToNewHoldingForm() {
      switchTab("debt");
    }

    function addDeposit() {
      const amount = parseFloat(String(document.getElementById("deposit-amount")?.value || "").replace(/,/g, ""));
      if (isNaN(amount) || amount <= 0) { alert("请输入有效金额"); return; }
      const account = document.getElementById("deposit-account")?.value || "pool";
      const note = (document.getElementById("deposit-note")?.value || "").trim();
      const ov = loadOverridesNormalized();
      ov.deposits.push({
        id: "dep-" + Date.now(),
        amount: Math.round(amount),
        account,
        note,
        date: new Date().toISOString().slice(0, 10),
      });
      saveOverrides(ov);
      closeFinanceDepositModal();
      renderAll();
    }

    function addLocalHolding() {
      const name = (document.getElementById("local-holding-name")?.value || "").trim();
      const code = (document.getElementById("local-holding-code")?.value || "").trim();
      const market = document.getElementById("local-holding-market")?.value || "sh";
      const shares = parseInt(document.getElementById("local-holding-shares")?.value, 10);
      const cost = parseFloat(document.getElementById("local-holding-cost")?.value);
      const account = document.getElementById("local-holding-account")?.value || "hb";
      const fallbackRaw = document.getElementById("local-holding-fallback")?.value;
      const fallback = fallbackRaw ? parseFloat(fallbackRaw) : cost;
      if (!name) { alert("请填写股票名称"); return; }
      if (!code) { alert("请填写代码"); return; }
      if (isNaN(shares) || shares <= 0) { alert("请填写有效股数"); return; }
      if (isNaN(cost) || cost <= 0) { alert("请填写有效成本价"); return; }
      const symbol = buildSymbol(code, market);
      if (!symbol) { alert("代码无效"); return; }
      const hk = market === "hk";
      const ov = loadOverridesNormalized();
      ov.newHoldings.push({
        id: "local-" + Date.now(),
        name,
        account,
        symbol,
        shares,
        costPerShare: cost,
        currency: hk ? "HKD" : "CNY",
        hk,
        fallbackPrice: isNaN(fallback) || fallback <= 0 ? cost : fallback,
        sold: false,
        local: true,
      });
      saveOverrides(ov);
      clearLocalHoldingForm();
      renderAll();
      showEffectToast("已加入持仓", `${name} · ${shares.toLocaleString()} 股`, [`${acctLabel(account)} · 成本 ${cost}`]);
    }

    function acctLabel(account) {
      return account === "gt" ? "国投" : "华宝";
    }

    function removeDeposit(id) {
      const ov = loadOverridesNormalized();
      ov.deposits = ov.deposits.filter(d => d.id !== id);
      saveOverrides(ov);
      renderAll();
    }

    function removeLocalHolding(id) {
      if (!confirm("删除这条本地新仓记录？")) return;
      const ov = loadOverridesNormalized();
      ov.newHoldings = (ov.newHoldings || []).filter(h => h.id !== id);
      if (ov.holdings?.[id]) delete ov.holdings[id];
      saveOverrides(ov);
      renderAll();
    }

    function renderMonthlyTable(todoState) {
      const tbody = document.querySelector("#monthly-table tbody");
      if (!tbody) return;
      tbody.innerHTML = "";
      months.forEach(row => {
        const total = ceilSum(row);
        const tr = document.createElement("tr");
        const monthTodos = MONTH_TODO_MAP[row.label] || [];
        const allDone = monthTodos.length > 0 && monthTodos.every(id => isTodoDone(todoState, id));
        if (row.peak && !allDone) tr.classList.add("peak");
        if (row.aug) tr.classList.add("aug");
        if (row.light || allDone) tr.classList.add("light");

        let badge = "";
        if (allDone) badge = '<span class="badge-done">已还</span>';
        else if (row.peak) badge = '<span class="badge danger">高峰</span>';
        else if (row.aug) badge = '<span class="badge purple">含个人20万</span>';
        else if (row.light) badge = '<span class="badge ok">末月</span>';

        tr.innerHTML = `
          <td>${row.label}${badge}</td>
          <td>${fmtTable(row.jd)}</td>
          <td class="col-cleared">${fmtTable(row.didi)}</td>
          <td class="col-cleared">${fmtTable(row.dy)}</td>
          <td>${fmtTable(row.ali)}</td>
          <td>${row.personal ? "200,000.00" : '<span class="dash">—</span>'}</td>
          <td class="month-total">${total.toLocaleString("zh-CN")}</td>`;
        tbody.appendChild(tr);
      });
    }

    function renderAll() {
      const todoState = loadTodoState();
      const state = computeState(todoState);
      updatePageDates();
      renderQuoteBar();
      renderDebts(state);
      renderHoldings(state);
      renderHome(state, todoState);
      renderPlanSummary(todoState);
      renderFunds(state);
      renderDiagnosis(state);
      renderAdjustments(state);
      renderMonthlyTable(todoState);
    }

    function renderHome(state, todoState) {
      const active = state.holdings.filter(h => !h.sold);
      const secTotal = document.getElementById("home-sec-total");
      const secPnl = document.getElementById("home-sec-pnl");
      const holdCount = document.getElementById("home-holdings-count");
      const netSub = document.getElementById("home-net-worth-sub");
      if (secTotal) secTotal.textContent = fmtInt(state.securitiesTotal);
      if (secPnl) {
        secPnl.textContent = (state.stockPnl >= 0 ? "+" : "") + fmtInt(state.stockPnl);
        secPnl.className = "val " + (state.stockPnl >= 0 ? "gain" : "loss");
      }
      if (holdCount) holdCount.textContent = String(active.length);
      if (netSub) {
        const cashPart = state.extraCash > 0 ? ` · 额外现金 ${fmtInt(state.extraCash)}` : "";
        netSub.textContent = `净资产 ${fmtInt(state.netWorth)} · 负债 ${fmtInt(state.liabilitiesTotal)}${cashPart}`;
      }

      const urgentAmt = document.getElementById("home-urgent-amount");
      const urgentSub = document.getElementById("home-urgent-sub");
      const next = getNextUrgentTodo(todoState);
      if (next?.item && urgentAmt && urgentSub) {
        urgentAmt.textContent = fmtInt(next.item.defaultAmount || 0);
        const days = daysUntilJuly4();
        const dayHint = next.id === "jul-jd-pay" ? ` · 距 7/4 还有 ${days} 天` : "";
        urgentSub.textContent = `${next.month} · ${next.item.text.replace(/<[^>]+>/g, "")}${dayHint}`;
      } else if (urgentAmt && urgentSub) {
        urgentAmt.textContent = "—";
        urgentSub.textContent = "近期待办已全部完成";
      }
    }

    function runHomeScreen() {
      const sym = document.getElementById("home-symbol-input")?.value?.trim();
      switchTab("screen");
      if (sym) {
        const input = document.getElementById("symbol-input");
        if (input) input.value = sym;
        window.ScreenUI?.init?.();
        document.getElementById("btn-screen")?.click();
      }
    }

    function getTodoItemById(id) {
      for (const g of TODO_GROUPS) {
        const item = g.items.find(i => i.id === id);
        if (item) return item;
      }
      return null;
    }

    const DEBT_LABELS = {
      jd: "京东金条", ali: "支付宝", dy: "抖音", didi: "滴滴", personal: "个人借款",
    };

    function deltaLine(label, before, after, suffix) {
      if (before === after) return null;
      const unit = suffix || "";
      return `${label}：${fmtInt(before)}${unit} → ${fmtInt(after)}${unit}`;
    }

    function buildEffectSummary(item, before, after, checked) {
      const lines = [];
      const tag = checked ? "已应用" : "已撤销";

      switch (item.effect) {
        case "sell_all": {
          const h = BASELINE.holdings.find(x => x.id === item.holdingId);
          if (h) lines.push(`${tag} · ${h.name} 整仓卖出`);
          break;
        }
        case "sell_partial": {
          const bH = before.holdings.find(h => h.id === item.holdingId);
          const aH = after.holdings.find(h => h.id === item.holdingId);
          if (bH && aH) {
            const tail = aH.sold || aH.shares <= 0 ? "已清仓" : `剩余 ${aH.shares.toLocaleString()} 股`;
            lines.push(`${tag} · ${bH.name}：${bH.shares.toLocaleString()} 股 → ${tail}`);
          }
          break;
        }
        case "debt_clear":
          lines.push(`${tag} · ${DEBT_LABELS[item.platform] || item.platform} 负债结清`);
          break;
        case "debt_pay": {
          for (const [plat, val] of Object.entries(item.pay || {})) {
            const b = before.debts[plat];
            const a = after.debts[plat];
            if (b !== a) lines.push(`${tag} · ${DEBT_LABELS[plat]}：${fmtInt(b)} → ${fmtInt(a)}`);
          }
          break;
        }
        case "fund_redeem_all":
          lines.push(`${tag} · 理财通 4 只基金全部赎回`);
          break;
      }

      const metrics = [
        deltaLine("证券总资产", before.securitiesTotal, after.securitiesTotal),
        deltaLine("基金总额", before.fundsTotal, after.fundsTotal),
        deltaLine("负债合计", before.liabilitiesTotal, after.liabilitiesTotal),
        deltaLine("净资产", before.netWorth, after.netWorth),
      ].filter(Boolean);

      return lines.concat(metrics);
    }

    function showEffectToast(title, subtitle, lines) {
      const toast = document.getElementById("effect-toast");
      const list = document.getElementById("effect-toast-list");
      const titleEl = document.getElementById("effect-toast-title");
      const subEl = document.getElementById("effect-toast-sub");
      if (!toast || !list) return;
      titleEl.textContent = title;
      subEl.textContent = subtitle || "";
      list.innerHTML = lines.map(l => `<li>${l}</li>`).join("");
      toast.classList.remove("hidden");
    }

    function hideEffectToast() {
      document.getElementById("effect-toast")?.classList.add("hidden");
    }

    document.getElementById("effect-toast-close")?.addEventListener("click", hideEffectToast);
    document.getElementById("effect-toast")?.addEventListener("click", e => {
      if (e.target.id === "effect-toast") hideEffectToast();
    });

    function editTodoAmount(id) {
      const item = getTodoItemById(id);
      if (!item || item.defaultAmount == null) return;
      const state = loadTodoState();
      const entry = getTodoEntry(state, id);
      const current = entry.actual != null ? entry.actual : item.defaultAmount;
      const input = prompt(`「${id}」实际金额（计划 ${fmtInt(item.defaultAmount)}）：`, String(Math.round(current)));
      if (input === null) return;
      const num = parseFloat(input.replace(/,/g, ""));
      if (isNaN(num) || num < 0) { alert("请输入有效数字"); return; }
      state[id] = { done: true, actual: num, actualPrice: entry.actualPrice };
      saveTodoState(state);
      renderTodos();
      renderAll();
    }

    function editTodoPrice(id) {
      const item = getTodoItemById(id);
      if (!item || !item.holdingId) return;
      const h = BASELINE.holdings.find(x => x.id === item.holdingId);
      if (!h) return;
      const state = loadTodoState();
      const entry = getTodoEntry(state, id);
      const curLabel = h.currency === "HKD" ? "HKD" : "CNY";
      const shares = item.sellShares ?? h.shares;
      const input = prompt(`${h.name} 卖出单价（${curLabel}，${shares} 股）：`, entry.actualPrice != null ? String(entry.actualPrice) : "");
      if (input === null) return;
      const num = parseFloat(input.replace(/,/g, ""));
      if (isNaN(num) || num <= 0) { alert("请输入有效数字"); return; }
      state[id] = { done: true, actualPrice: num, actual: null };
      saveTodoState(state);
      renderTodos();
      renderAll();
    }

    function renderTodos() {
      const state = loadTodoState();
      const container = document.getElementById("todo-container");
      let total = 0, done = 0;

      container.innerHTML = TODO_GROUPS.map(group => {
        let groupDone = 0;
        const itemsHtml = group.items.map(item => {
          total++;
          const entry = getTodoEntry(state, item.id);
          const checked = entry.done;
          if (checked) done++, groupDone++;
          const urgent = item.urgent && !checked ? " urgent" : "";
          const doneCls = checked ? " done" : "";
          const hasAmount = item.defaultAmount != null;
          const isSell = item.effect === "sell_all" || item.effect === "sell_partial";
          const actualTag = entry.actual != null && entry.actual !== item.defaultAmount
            ? `<span class="todo-actual-tag">（实际 ${fmtInt(entry.actual)}）</span>` : "";
          const priceTag = entry.actualPrice != null
            ? `<span class="todo-actual-tag">（单价 ${entry.actualPrice}）</span>` : "";
          const editBtn = checked && hasAmount
            ? `<button type="button" class="edit-amount-btn" data-edit="${item.id}">改金额</button>` : "";
          const editPriceBtn = checked && isSell
            ? `<button type="button" class="edit-amount-btn" data-edit-price="${item.id}">改单价</button>` : "";
          return `
            <li class="todo-item${doneCls}${urgent}" data-id="${item.id}">
              <input type="checkbox" id="${item.id}" ${checked ? "checked" : ""} aria-label="完成">
              <label for="${item.id}">${item.text}${actualTag}${priceTag}</label>
              ${editBtn}${editPriceBtn}
            </li>`;
        }).join("");
        const allDone = groupDone === group.items.length;
        const isArchive = group.title.includes("已完成");
        const body = `
            <div class="todo-group-head">
              <h3>${group.title}</h3>
              <span class="todo-group-count">${groupDone}/${group.items.length}</span>
            </div>
            <ul class="todo-list">${itemsHtml}</ul>`;
        if (isArchive) {
          return `<details class="todo-group-fold"${allDone ? "" : " open"}><summary>${group.title}（${groupDone}/${group.items.length}）</summary><ul class="todo-list">${itemsHtml}</ul></details>`;
        }
        return `
          <div class="todo-group">${body}</div>`;
      }).join("");

      document.getElementById("todo-done").textContent = done;
      document.getElementById("todo-total").textContent = total;
      document.getElementById("todo-bar").style.width = total ? (done / total * 100) + "%" : "0%";

      const homeDone = document.getElementById("home-todo-done");
      const homeTotal = document.getElementById("home-todo-total");
      const homeBar = document.getElementById("home-todo-bar");
      if (homeDone) homeDone.textContent = done;
      if (homeTotal) homeTotal.textContent = total;
      if (homeBar) homeBar.style.width = total ? (done / total * 100) + "%" : "0%";

      container.querySelectorAll(".todo-item").forEach(row => {
        const id = row.dataset.id;
        const cb = row.querySelector('input[type="checkbox"]');
        const toggle = () => {
          const s = loadTodoState();
          const prev = getTodoEntry(s, id);
          const item = getTodoItemById(id);
          const beforeState = item?.effect ? computeState(s) : null;

          if (cb.checked) {
            s[id] = { done: true, actual: prev.actual, actualPrice: prev.actualPrice };
          } else {
            s[id] = { done: false, actual: prev.actual, actualPrice: prev.actualPrice };
          }
          saveTodoState(s);

          if (item?.effect && beforeState && prev.done !== cb.checked) {
            const afterState = computeState(s);
            const lines = buildEffectSummary(item, beforeState, afterState, cb.checked);
            const plain = item.text.replace(/<[^>]+>/g, "");
            showEffectToast(
              cb.checked ? "财务数据已更新" : "操作已撤销，数据已恢复",
              plain.slice(0, 60) + (plain.length > 60 ? "…" : ""),
              lines.length ? lines : ["相关汇总指标暂无变化"]
            );
          }

          renderTodos();
          renderAll();
        };
        cb.addEventListener("change", toggle);
        row.addEventListener("click", e => {
          if (e.target.classList.contains("edit-amount-btn")) return;
          if (e.target.dataset.editPrice) return;
          if (e.target.tagName === "INPUT" || e.target.tagName === "LABEL" || e.target.tagName === "BUTTON") return;
          cb.checked = !cb.checked;
          toggle();
        });
      });

      container.querySelectorAll(".edit-amount-btn[data-edit]").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          editTodoAmount(btn.dataset.edit);
        });
      });

      container.querySelectorAll(".edit-amount-btn[data-edit-price]").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          editTodoPrice(btn.dataset.editPrice);
        });
      });
    }

    document.getElementById("quote-reload")?.addEventListener("click", () => location.reload());

    document.getElementById("todo-reset")?.addEventListener("click", () => {
      if (confirm("确定重置全部待办勾选？财务数据将恢复基准。")) {
        localStorage.removeItem(TODO_STORAGE_KEY);
        localStorage.removeItem(TODO_STORAGE_KEY_V1);
        renderTodos();
        renderAll();
      }
    });

    document.getElementById("btn-add-deposit")?.addEventListener("click", openFinanceDepositModal);
    document.getElementById("btn-add-local-holding")?.addEventListener("click", goToNewHoldingForm);
    document.getElementById("finance-deposit-submit")?.addEventListener("click", addDeposit);
    document.getElementById("finance-deposit-cancel")?.addEventListener("click", closeFinanceDepositModal);
    document.getElementById("finance-holding-submit")?.addEventListener("click", addLocalHolding);
    document.getElementById("finance-holding-clear")?.addEventListener("click", clearLocalHoldingForm);
    document.getElementById("finance-deposit-modal")?.addEventListener("click", e => {
      if (e.target.id === "finance-deposit-modal") closeFinanceDepositModal();
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.page));
    });

    const PAGE_TITLES = {
      plan: "执行", debt: "概况",
    };

    function closeShellDrawer() {
      document.getElementById("shell-sidebar")?.classList.remove("open");
      const ov = document.getElementById("shell-overlay");
      if (ov) ov.hidden = true;
    }

    function switchTab(page) {
      window.ScreenHoldings?.closeModal?.();
      closeShellDrawer();
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      const btn = document.querySelector(`.tab-btn[data-page="${page}"]`);
      if (btn) {
        btn.classList.add("active");
        btn.closest(".nav-group")?.setAttribute("open", "");
      }
      const el = document.getElementById("page-" + page);
      if (el) el.classList.add("active");
      const titleEl = document.getElementById("shell-page-title");
      if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;
      if (page === "screen") {
        history.replaceState(null, "", "#screen");
        window.ScreenUI?.init();
      } else if (page === "home") {
        if (location.hash) history.replaceState(null, "", location.pathname);
      } else if (page === "criteria") {
        history.replaceState(null, "", "#criteria");
        window.CriteriaView?.load?.();
      } else if (page === "books") {
        history.replaceState(null, "", "#books");
        window.BooksView?.load?.();
      } else if (page === "handbook") {
        history.replaceState(null, "", "#handbook");
        window.HandbookView?.load?.();
      } else if (page === "etf") {
        history.replaceState(null, "", "#etf");
        window.EtfPlanView?.render?.();
      } else if (location.hash === "#screen" || location.hash === "#criteria" || location.hash === "#books" || location.hash.startsWith("#books") || location.hash === "#handbook" || location.hash === "#etf") {
        history.replaceState(null, "", location.pathname);
      }
    }
    window.switchTab = switchTab;

    document.getElementById("btn-home-screen")?.addEventListener("click", runHomeScreen);
    document.getElementById("home-symbol-input")?.addEventListener("keydown", e => {
      if (e.key === "Enter") runHomeScreen();
    });
    document.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.goto));
    });

    if (location.hash === "#screen") switchTab("screen");
    if (location.hash === "#criteria") switchTab("criteria");
    if (location.hash === "#books" || location.hash.startsWith("#books")) switchTab("books");
    if (location.hash === "#handbook") switchTab("handbook");
    if (location.hash === "#etf") switchTab("etf");

    document.getElementById("shell-menu-btn")?.addEventListener("click", () => {
      document.getElementById("shell-sidebar")?.classList.add("open");
      const ov = document.getElementById("shell-overlay");
      if (ov) ov.hidden = false;
    });
    document.getElementById("shell-overlay")?.addEventListener("click", closeShellDrawer);

    (function initNavGroups() {
      const KEY = "lcai-nav-groups";
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) {}
      document.querySelectorAll(".nav-group").forEach(group => {
        const id = group.dataset.navGroup;
        if (id && saved[id] === false) group.removeAttribute("open");
        group.addEventListener("toggle", () => {
          if (!id) return;
          saved[id] = group.open;
          localStorage.setItem(KEY, JSON.stringify(saved));
        });
      });
    })();

  function getPendingTodos(limit) {
    const todoState = loadTodoState();
    const result = [];
    const max = limit == null ? 10 : limit;
    for (const month of Object.keys(MONTH_TODO_MAP)) {
      for (const id of MONTH_TODO_MAP[month]) {
        if (isTodoDone(todoState, id)) continue;
        const item = getTodoItemById(id);
        if (!item) continue;
        result.push({
          id: id,
          month: month,
          text: item.text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
          href: "finance/index.html#plan",
        });
        if (result.length >= max) return result;
      }
    }
    return result;
  }

  function getPortalSummary() {
    try {
      const todoState = loadTodoState();
      const state = computeState(todoState);
      const next = getNextUrgentTodo(todoState);
      let sub = "净资产 " + fmtInt(state.netWorth) + " · 负债 " + fmtInt(state.liabilitiesTotal);
      if (next && next.item) sub = next.item.text.replace(/<[^>]+>/g, "").slice(0, 48);
      return { title: "财务计划", sub: sub, href: "finance/index.html", lock: true };
    } catch (e) {
      return { title: "财务计划", sub: "请配置 finance-config", href: "finance/index.html", lock: true };
    }
  }

  function initFinanceWorkbench(opts) {
    opts = opts || {};
    if (typeof opts.switchTab === "function") {
      global.switchTab = opts.switchTab;
      FinanceCore.switchTab = opts.switchTab;
    }
    renderTodos();
    global.__lcaiRenderAll = renderAll;
    renderAll();
    global.LCAIAdminGate?.initOverview?.("finance");
  }

  global.FinanceCore = {
    init: initFinanceWorkbench,
    renderAll: renderAll,
    computeState: computeState,
    loadTodoState: loadTodoState,
    getPendingTodos: getPendingTodos,
    getPortalSummary: getPortalSummary,
    switchTab: null,
  };
})(window);
