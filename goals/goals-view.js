(function (global) {
  "use strict";

  function el(id) {
    return document.getElementById(id);
  }

  function applyOverrides(data) {
    if (!global.LifeSync) return data;
    var ov = LifeSync.getGoalsOverrides();
    var krs = (data.quarter && data.quarter.key_results) || [];
    krs.forEach(function (kr) {
      if (ov.krProgress && ov.krProgress[kr.id] != null) {
        kr.progress = ov.krProgress[kr.id];
      }
    });
    if (data.season_books && ov.seasonBooks) {
      data.season_books.forEach(function (b) {
        if (ov.seasonBooks[b.id]) b.status = ov.seasonBooks[b.id];
      });
    }
    return data;
  }

  function renderGoals(data) {
    data = applyOverrides(data);
    var obj = el("goals-objective");
    var quarter = el("goals-quarter");
    var list = el("goals-kr-list");
    var theme = el("goals-theme");
    var phase = el("goals-phase");
    var notDo = el("goals-not-do");

    if (theme) theme.textContent = data.theme ? "年度主题：" + data.theme : "";
    if (obj) obj.textContent = data.objective || "—";
    if (quarter) {
      var phaseNote = data.phase ? " · " + data.phase.name + "（～" + data.phase.until + "）" : "";
      quarter.textContent = (data.year || "") + " · " + ((data.quarter && data.quarter.name) || "") + phaseNote;
    }
    if (phase && data.phase) {
      phase.innerHTML =
        '当前阶段：<strong>' +
        data.phase.name +
        '</strong>（至 ' +
        data.phase.until +
        '）· <a href="life-phases.md">阶段叙事</a> · <a href="../principles/life-constitution.md">人生宪法</a>';
    }
    if (notDo && data.not_do && data.not_do.length) {
      notDo.innerHTML =
        '<h2 class="kb-section-title">本季不做</h2><ul>' +
        data.not_do
          .map(function (x) {
            return "<li>" + x + "</li>";
          })
          .join("") +
        "</ul>";
    }

    if (!list || !data.quarter) return;
    var krs = data.quarter.key_results || [];
    list.innerHTML = krs
      .map(function (kr) {
        var pct = kr.target ? Math.min(100, Math.round((kr.progress / kr.target) * 100)) : kr.progress;
        var unit = kr.unit || "";
        var link = kr.link ? ' <a href="' + kr.link + '" style="font-size:0.82rem">模块 →</a>' : "";
        var edit =
          '<div class="goals-kr-edit">' +
          '<label>更新进度 <input type="number" min="0" step="1" data-kr-id="' +
          kr.id +
          '" value="' +
          kr.progress +
          '"> / ' +
          kr.target +
          (unit ? " " + unit : "") +
          '</label> <button type="button" class="goals-kr-save" data-kr-id="' +
          kr.id +
          '">保存</button></div>';
        return (
          '<li class="goals-kr-item"><div class="goals-kr-head"><strong>' +
          kr.title +
          "</strong><span>" +
          kr.progress +
          " / " +
          kr.target +
          (unit ? " " + unit : "") +
          '</span></div><div class="module-progress-bar"><span style="width:' +
          pct +
          '%"></span></div>' +
          edit +
          link +
          "</li>"
        );
      })
      .join("");

    list.querySelectorAll(".goals-kr-save").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var krId = btn.dataset.krId;
        var input = list.querySelector('input[data-kr-id="' + krId + '"]');
        if (!input || !global.LifeSync) return;
        LifeSync.setKrProgress(krId, input.value);
        fetch("goals.json")
          .then(function (r) {
            return r.json();
          })
          .then(renderGoals);
      });
    });

    var reviews = el("goals-reviews");
    if (reviews && data.reviews) {
      reviews.innerHTML = data.reviews
        .map(function (r) {
          return '<li><a href="reviews/' + r.id + '.md" target="_blank" rel="noopener">' + r.title + "</a></li>";
        })
        .join("");
    }
  }

  function init() {
    var load = function () {
      fetch("goals.json")
        .then(function (r) {
          return r.json();
        })
        .then(renderGoals)
        .catch(function () {
          if (el("goals-objective")) el("goals-objective").textContent = "无法加载 goals.json";
        });
    };
    if (global.LifeSync && LifeSync.init) {
      LifeSync.init().then(load);
      LifeSync.onChange(load);
    } else {
      load();
    }
  }

  global.GoalsView = { init: init };
})(window);
