'use strict';

(function () {
  if (!window.EventSource) return;

  var source = null;
  var reconnectTimer = null;
  var wasDisconnected = false;

  function swapStylesheet(targetPath) {
    var links = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
    var current = null;
    for (var i = 0; i < links.length; i += 1) {
      try {
        if (new URL(links[i].href, window.location.href).pathname === targetPath) {
          current = links[i];
          break;
        }
      } catch (_) { /* ignore malformed hrefs */ }
    }
    if (!current) {
      window.location.reload();
      return;
    }
    var next = current.cloneNode();
    var url = new URL(current.href, window.location.href);
    url.searchParams.set('t', String(Date.now()));
    next.href = url.toString();
    next.addEventListener('load', function () { current.remove(); }, { once: true });
    next.addEventListener('error', function () { next.remove(); }, { once: true });
    current.after(next);
  }

  function handle(payload) {
    if (payload && payload.type === 'css' && payload.path) {
      swapStylesheet(payload.path);
      return;
    }
    window.location.reload();
  }

  function connect() {
    source = new EventSource('/__dev/reload');

    source.addEventListener('open', function () {
      if (!wasDisconnected) return;
      // The dev server restarted (source change) — pick up the new code.
      wasDisconnected = false;
      window.location.reload();
    });

    source.addEventListener('message', function (event) {
      try { handle(JSON.parse(event.data)); } catch (_) { window.location.reload(); }
    });

    source.addEventListener('error', function () {
      wasDisconnected = true;
      if (source) source.close();
      source = null;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, 1000);
    });
  }

  connect();
}());
