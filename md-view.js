/** 轻量 Markdown 渲染（GitHub Pages 静态页用） */
(function (global) {
  "use strict";

  var MARKED_CDN = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

  function loadMarked() {
    if (global.marked && global.marked.parse) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-md-view-marked="1"]')) {
        var t = setInterval(function () {
          if (global.marked) {
            clearInterval(t);
            resolve();
          }
        }, 50);
        setTimeout(function () {
          clearInterval(t);
          resolve();
        }, 5000);
        return;
      }
      var s = document.createElement("script");
      s.src = MARKED_CDN;
      s.dataset.mdViewMarked = "1";
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("无法加载 marked"));
      };
      document.head.appendChild(s);
    });
  }

  function fixLinks(html, basePath) {
    basePath = basePath || "";
    return html.replace(/href="([^"]+)"/g, function (_m, href) {
      if (/^(https?:|#|mailto:)/.test(href)) return 'href="' + href + '"';
      if (href.indexOf("../") === 0 || href.indexOf("./") === 0) return 'href="' + href + '"';
      return 'href="' + basePath + href + '"';
    });
  }

  function renderInto(el, md, opts) {
    opts = opts || {};
    if (!el) return Promise.reject(new Error("no element"));
    el.innerHTML = "<p>加载中…</p>";
    return loadMarked()
      .then(function () {
        if (global.marked.setOptions) {
          marked.setOptions({ gfm: true, breaks: true });
        }
        el.innerHTML = fixLinks(marked.parse(md || ""), opts.basePath || "");
        el.classList.add("md-body");
      })
      .catch(function (e) {
        el.innerHTML = "<p>渲染失败：" + (e.message || e) + "</p>";
      });
  }

  function fetchRender(el, url, opts) {
    opts = opts || {};
    if (!el) return Promise.resolve();
    el.innerHTML = "<p>加载中…</p>";
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(url + " (" + r.status + ")");
        return r.text();
      })
      .then(function (md) {
        return renderInto(el, md, opts);
      })
      .catch(function (e) {
        el.innerHTML = "<p>无法加载：" + (e.message || e) + "</p>";
      });
  }

  global.MdView = { fetchRender: fetchRender, renderInto: renderInto, loadMarked: loadMarked };
})(window);
