#!/usr/bin/env node
/** Smoke test for quotes + computeState logic. */

const fs = require("fs");
const path = require("path");

global.window = global;
eval(fs.readFileSync(path.join(__dirname, "quotes-data.js"), "utf8"));

const html = fs.readFileSync(path.join(__dirname, "资产总览.html"), "utf8");
const full = html.match(/<script src="quotes-data.js"><\/script>\s*<script>([\s\S]*?)<\/script>/)[1];
const core = full.split('document.getElementById("quote-reload")')[0];

const localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };

eval(core);

let errors = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    errors++;
  } else {
    console.log("OK:", msg);
  }
}

const base = computeState({});
assert(base.holdings.filter(h => !h.sold).length === 7, "7 active holdings");
assert(base.securitiesTotal > 1000000, "securities total > 1M: " + base.securitiesTotal);
assert(base.holdings.every(h => typeof h.marketValue === "number"), "marketValue computed");

localStorage.setItem("lcai-portfolio-overrides", JSON.stringify({ holdings: { pingan: { costPerShare: 10, manualPrice: 9 } } }));
const ov = computeState({});
const pa = ov.holdings.find(h => h.id === "pingan");
assert(pa.costPerShare === 10, "cost override");
assert(pa.nativePrice === 9, "manual price override");
assert(pa.marketValue === Math.round(40700 * 9 * ov.fxRate), "pingan MV from manual price");

localStorage.setItem("lcai-exec-todos-v2", JSON.stringify({ "jun-sell-mgt": { done: true } }));
const sold = computeState(JSON.parse(localStorage.getItem("lcai-exec-todos-v2")));
assert(!sold.holdings.find(h => h.id === "megmeet" && !h.sold), "megmeet sold after todo");

localStorage.setItem("lcai-exec-todos-v2", JSON.stringify({ "aug-sell-pa": { done: true, actualPrice: 8.5 } }));
const partial = computeState(JSON.parse(localStorage.getItem("lcai-exec-todos-v2")));
const pa2 = partial.holdings.find(h => h.id === "pingan");
assert(pa2 && pa2.shares === 40700 - 5044, "partial sell reduces shares: " + pa2?.shares);

process.exit(errors ? 1 : 0);
