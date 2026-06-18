(function (global) {
  "use strict";

  function initSidebar() {
    var btn = document.querySelector(".kb-hamburger");
    var sidebar = document.getElementById("kb-sidebar");
    if (btn && sidebar) {
      btn.addEventListener("click", function () {
        sidebar.classList.toggle("open");
      });
    }
  }

  global.KBShell = { initSidebar: initSidebar };
})(window);
