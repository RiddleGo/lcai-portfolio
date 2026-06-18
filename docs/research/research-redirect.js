(function () {
  var byFile = window.LCAI_RESEARCH.byFile;
  var bySlug = window.LCAI_RESEARCH.bySlug;
  var params = new URLSearchParams(location.search);
  var legacyDoc = params.get("doc");
  if (legacyDoc && byFile[legacyDoc]) {
    location.replace("read.html?p=" + byFile[legacyDoc].slug);
    return;
  }
  var p = params.get("p");
  if (p && bySlug[p]) {
    location.replace("read.html?p=" + p);
    return;
  }
})();
