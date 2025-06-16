// Minimal JSZip loader for browser (for ZIP download)
// Uses CDN if not present
(function(){
  if (!window.JSZip) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = function() { window._jszipReady = true; };
    document.head.appendChild(s);
  } else {
    window._jszipReady = true;
  }
})();
