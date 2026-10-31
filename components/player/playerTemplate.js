/**
 * playerTemplate — builds the HTML document loaded inside the native WebView.
 * ---------------------------------------------------------------------------
 * The page bundles:
 *   - Video.js 8 (minified dist, inlined — no CDN, works offline)
 *   - VHS (@videojs/http-streaming, bundled in Video.js 8) for HLS playback
 *   - a Vanakkam TV themed custom control bar (play/pause, volume, mute,
 *     LIVE badge, fullscreen) in dark-cinema style with marigold accent
 *   - the RN <-> player bridge (postMessage out, document/window message in)
 *   - auto-reconnect for mid-playback network drops + per-source watchdog
 *   - honest error reporting (categories decided on the RN side)
 *
 * The page is ES5-safe and deliberately avoids backticks/`${}` so it can be
 * embedded in a JS template literal. `</script>` never appears in injected
 * sources (guarded when videojs.source.js is generated).
 */

import videoJsSource from "./videojs.source";

export function buildPlayerHtml({ debug = false } = {}) {
  const pageJs = PAGE_JS.replace("__VK_DEBUG__", debug ? "true" : "false");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden;
    font-family: -apple-system, Roboto, "Segoe UI", sans-serif; }
  #vk-stage { position: fixed; inset: 0; background: #000; }
  #vjs-vanakkam { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }

  /* loading ring */
  #vk-spinner { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px;
    margin: -23px 0 0 -23px; border-radius: 50%; display: none;
    border: 3px solid rgba(255,255,255,0.15); border-top-color: #FFB020;
    animation: vkspin 0.9s linear infinite; z-index: 30; pointer-events: none; }
  body.vk-loading #vk-spinner { display: block; }
  @keyframes vkspin { to { transform: rotate(360deg); } }

  /* status strip (reconnecting / source hints) */
  #vk-status { position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    background: rgba(10,11,18,0.78); color: #F5F6FA; font-size: 12px; line-height: 1.35;
    padding: 7px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12);
    display: none; z-index: 40; max-width: 82%; text-align: center; }
  #vk-status.vk-show { display: block; }

  /* control bar */
  #vk-bar { position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 50;
    display: flex; align-items: center; gap: 10px; padding: 8px 12px;
    background: rgba(10,11,18,0.72); border: 1px solid rgba(255,255,255,0.10);
    border-radius: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    opacity: 0; transition: opacity 0.25s ease; }
  body.vk-controls #vk-bar { opacity: 1; }
  .vk-btn { width: 40px; height: 40px; min-width: 40px; border-radius: 20px; border: 0;
    background: rgba(255,255,255,0.06); color: #F5F6FA; font-size: 17px;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .vk-btn:active { background: rgba(255,176,32,0.25); }
  .vk-btn.vk-accent { color: #FFB020; }
  #vk-mute.vk-needs-unmute { border: 1px solid #FFB020; color: #FFB020;
    animation: vkpulse 1.6s ease infinite; }
  @keyframes vkpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,176,32,0.5); }
    50% { box-shadow: 0 0 0 6px rgba(255,176,32,0); } }
  #vk-vol { -webkit-appearance: none; appearance: none; width: 78px; height: 3px;
    border-radius: 3px; background: rgba(255,255,255,0.25); outline: none; }
  #vk-vol::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px;
    border-radius: 50%; background: #FFB020; }
  #vk-live { display: none; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 999px; background: rgba(255,59,92,0.16);
    color: #FF3B5C; font-size: 10px; font-weight: 900; letter-spacing: 1px; }
  #vk-live.vk-on { display: flex; }
  #vk-live .dot { width: 6px; height: 6px; border-radius: 3px; background: #FF3B5C;
    animation: vkpulse2 1.4s ease infinite; }
  @keyframes vkpulse2 { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
  #vk-time { color: #9AA0B4; font-size: 11.5px; font-variant-numeric: tabular-nums;
    display: none; }
  #vk-time.vk-on { display: block; }
  #vk-spring { flex: 1; }
  @media (orientation: landscape) { #vk-bar { left: 16px; right: 16px; bottom: 14px; } }
</style>
</head>
<body>
  <div id="vk-stage">
    <video id="vjs-vanakkam" playsinline webkit-playsinline x5-playsinline preload="auto"></video>
    <div id="vk-spinner"></div>
    <div id="vk-status"></div>
    <div id="vk-bar">
      <button id="vk-play" class="vk-btn vk-accent" aria-label="Play or pause">&#9654;</button>
      <button id="vk-mute" class="vk-btn" aria-label="Mute or unmute">&#128263;</button>
      <input id="vk-vol" type="range" min="0" max="100" step="1" value="100" aria-label="Volume" />
      <div id="vk-live"><span class="dot"></span>LIVE</div>
      <span id="vk-time">0:00</span>
      <div id="vk-spring"></div>
      <button id="vk-full" class="vk-btn" aria-label="Fullscreen">&#x26F6;</button>
    </div>
  </div>
<script>
${videoJsSource}
</script>
<script>
${pageJs}
</script>
</body>
</html>`;
}

/**
 * The page application. Plain ES5 string — no backticks, no ${}, no
 * '</script' inside string literals (uses split concatenation where needed).
 */
const PAGE_JS = [
  "(function () {",
  "  'use strict';",
  "  if (window.__VANAKKAM_PLAYER__) return;",
  "  window.__VANAKKAM_PLAYER__ = true;",
  "",
  "  var DEBUG = __VK_DEBUG__;",
  "  var RECONNECT_LIMIT = 3;",
  "  var RECONNECT_BASE_MS = 2000;",
  "  var player = null;",
  "  var currentSource = null;",
  "  var everStarted = false;",
  "  var reconnectTries = 0;",
  "  var watchdog = null;",
  "  var controlsTimer = null;",
  "  var inFullscreen = false;",
  "  var pending = [];",
  "",
  "  function send(type, payload) {",
  "    var msg;",
  "    try { msg = JSON.stringify({ type: type, payload: payload || {} }); } catch (e) { return; }",
  "    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {",
  "      window.ReactNativeWebView.postMessage(msg);",
  "    } else if (DEBUG) { console.log('[vk]', msg); }",
  "  }",
  "  function log(m) { if (DEBUG) send('LOG', { msg: String(m).slice(0, 240) }); }",
  "",
  "  function showStatus(text) {",
  "    var el = document.getElementById('vk-status');",
  "    if (!text) { el.className = ''; return; }",
  "    el.textContent = text; el.className = 'vk-show';",
  "  }",
  "  function setLoading(on) {",
  "    document.body.className = document.body.className.replace(/ ?vk-loading/g, '');",
  "    if (on) document.body.className += ' vk-loading';",
  "  }",
  "",
  "  function clearWatchdog() { if (watchdog) { clearTimeout(watchdog); watchdog = null; } }",
  "  function armWatchdog() {",
  "    clearWatchdog();",
  "    var t = (currentSource && currentSource.timeoutMs) || 15000;",
  "    watchdog = setTimeout(function () {",
  "      if (!everStarted) {",
  "        send('PLAYBACK_ERROR', { code: 0, requestId: srcReqId(),",
  "          url: srcUrl(),",
  "          message: 'No response after ' + Math.round(t / 1000) + 's (connection timeout)' });",
  "      }",
  "    }, t);",
  "  }",
  "  function srcReqId() { return currentSource ? currentSource.requestId : undefined; }",
  "  function srcUrl() { return currentSource ? currentSource.url : undefined; }",
  "",
  "  var FORBIDDEN = { 'user-agent': 1, referer: 1, host: 1, origin: 1, cookie: 1, connection: 1 };",
  "  function setCustomHeaders(headers) {",
  "    try {",
  "      var clean = {};",
  "      for (var k in (headers || {})) {",
  "        if (!FORBIDDEN[String(k).toLowerCase()] && headers[k]) clean[k] = headers[k];",
  "      }",
  "      if (videojs.Vhs && videojs.Vhs.xhr) {",
  "        videojs.Vhs.xhr.beforeRequest = function (opts) {",
  "          if (Object.keys(clean).length) {",
  "            opts.headers = Object.assign({}, opts.headers || {}, clean);",
  "          }",
  "          return opts;",
  "        };",
  "      }",
  "    } catch (e) { log('header hook failed'); }",
  "  }",
  "",
  "  function applySource(src) {",
  "    if (!src || !src.url) return;",
  "    currentSource = src;",
  "    everStarted = false;",
  "    reconnectTries = 0;",
  "    clearWatchdog();",
  "    setLoading(true);",
  "    showStatus('');",
  "    setCustomHeaders(src.headers);",
  "    try {",
  "      player.error(null);",
  "      player.src({ src: src.url, type: src.type || undefined });",
  "      var pr = player.play();",
  "      if (pr && pr.catch) pr.catch(function () {});",
  "    } catch (e) {",
  "      send('PLAYBACK_ERROR', { code: 0, requestId: srcReqId(), url: srcUrl(), message: String(e) });",
  "      return;",
  "    }",
  "    send('SOURCE_CHANGED', { requestId: src.requestId });",
  "    armWatchdog();",
  "  }",
  "",
  "  function isTransient(err) {",
  "    var m = ((err && err.message) || '').toLowerCase();",
  "    return (err && err.code === 2) || /network|timeout|connection|interrupted|reset/.test(m);",
  "  }",
  "",
  "  function scheduleReconnect() {",
  "    reconnectTries += 1;",
  "    var delay = RECONNECT_BASE_MS * reconnectTries;",
  "    showStatus('Connection lost — reconnecting (' + reconnectTries + '/' + RECONNECT_LIMIT + ')…');",
  "    send('BUFFERING', { buffering: true, reconnecting: true, attempt: reconnectTries });",
  "    setTimeout(function () {",
  "      if (!currentSource) return;",
  "      try {",
  "        player.error(null);",
  "        player.src({ src: currentSource.url, type: currentSource.type || undefined });",
  "        var pr = player.play();",
  "        if (pr && pr.catch) pr.catch(function () {});",
  "      } catch (e) {}",
  "    }, delay);",
  "  }",
  "",
  "  function initPlayer() {",
  "    var overrideNative = !(videojs.browser && (videojs.browser.IS_SAFARI || videojs.browser.IS_ANY_SAFARI || videojs.browser.IS_IOS));",
  "    player = videojs('vjs-vanakkam', {",
  "      controls: false,",
  "      autoplay: true,",
  "      muted: true,",
  "      preload: 'auto',",
  "      playsinline: true,",
  "      liveui: true,",
  "      responsive: false,",
  "      fill: true,",
  "      userActions: { hotkeys: false },",
  "      html5: { vhs: { overrideNative: overrideNative, withCredentials: false, limitRenditionByPlayerDimensions: false } }",
  "    });",
  "",
  "    player.on('loadstart', function () {",
  "      if (!everStarted) setLoading(true);",
  "      send('BUFFERING', { buffering: true, requestId: srcReqId() });",
  "    });",
  "    player.on('waiting', function () { send('BUFFERING', { buffering: true, requestId: srcReqId() }); });",
  "    player.on('canplay', function () { send('BUFFERING', { buffering: false }); });",
  "    player.on('playing', function () {",
  "      everStarted = true;",
  "      reconnectTries = 0;",
  "      clearWatchdog();",
  "      setLoading(false);",
  "      showStatus('');",
  "      send('PLAYBACK_STARTED', { requestId: srcReqId() });",
  "      scheduleControlsHide();",
  "    });",
  "    player.on('pause', function () { send('PLAYBACK_PAUSED', { requestId: srcReqId() }); });",
  "    player.on('ended', function () {",
  "      if (currentSource) scheduleReconnect(); // live streams should not end quietly",
  "    });",
  "    player.on('error', function () {",
  "      var err = player.error() || {};",
  "      if (everStarted && isTransient(err) && reconnectTries < RECONNECT_LIMIT) {",
  "        scheduleReconnect();",
  "        return;",
  "      }",
  "      setLoading(false);",
  "      send('PLAYBACK_ERROR', { code: err.code, requestId: srcReqId(), url: srcUrl(),",
  "        message: (err.message || 'Playback failed') + '' });",
  "    });",
  "  }",
  "",
  "  /* ------------------------------ custom controls ------------------------------ */",
  "  function qs(id) { return document.getElementById(id); }",
  "  function fmt(s) {",
  "    s = Math.max(0, Math.floor(s || 0));",
  "    var m = Math.floor(s / 60);",
  "    return m + ':' + ('0' + (s % 60)).slice(-2);",
  "  }",
  "  function updateLiveUi() {",
  "    try {",
  "      var lt = player.liveTracker;",
  "      var live = !!(lt && lt.isLive && lt.isLive());",
  "      var el = qs('vk-live');",
  "      var t = qs('vk-time');",
  "      if (live) { el.className = 'vk-on'; t.className = ''; }",
  "      else { el.className = ''; t.className = 'vk-on'; t.textContent = fmt(player.currentTime()); }",
  "    } catch (e) {}",
  "  }",
  "  function bindControls() {",
  "    var stage = qs('vk-stage');",
  "    stage.addEventListener('click', function (e) {",
  "      if (e.target.closest && e.target.closest('#vk-bar')) return;",
  "      document.body.className = document.body.className.indexOf('vk-controls') > -1",
  "        ? document.body.className.replace(/ ?vk-controls/g, '')",
  "        : document.body.className + ' vk-controls';",
  "      scheduleControlsHide();",
  "    });",
  "    qs('vk-play').addEventListener('click', function () {",
  "      if (player.paused()) { var pr = player.play(); if (pr && pr.catch) pr.catch(function(){}); }",
  "      else player.pause();",
  "    });",
  "    var muteBtn = qs('vk-mute');",
  "    function syncMute() {",
  "      muteBtn.innerHTML = player.muted() || player.volume() === 0 ? '&#128263;' : '&#128266;';",
  "      if (player.muted()) muteBtn.className = 'vk-btn vk-needs-unmute';",
  "      else muteBtn.className = 'vk-btn';",
  "      qs('vk-vol').value = Math.round((player.muted() ? 0 : player.volume()) * 100);",
  "    }",
  "    muteBtn.addEventListener('click', function () {",
  "      player.muted(!player.muted());",
  "      if (!player.muted() && player.volume() === 0) player.volume(0.6);",
  "      syncMute();",
  "    });",
  "    qs('vk-vol').addEventListener('input', function (e) {",
  "      var v = Number(e.target.value) / 100;",
  "      player.volume(v);",
  "      player.muted(v === 0);",
  "      syncMute();",
  "    });",
  "    player.on('volumechange', syncMute);",
  "    player.on('timeupdate', updateLiveUi);",
  "    player.on('durationchange', updateLiveUi);",
  "    qs('vk-full').addEventListener('click', function () {",
  "      if (inFullscreen) exitFullscreen(); else enterFullscreen();",
  "    });",
  "    syncMute();",
  "    document.body.className += ' vk-controls';",
  "    scheduleControlsHide();",
  "  }",
  "  function scheduleControlsHide() {",
  "    if (controlsTimer) clearTimeout(controlsTimer);",
  "    controlsTimer = setTimeout(function () {",
  "      if (!player.paused()) document.body.className = document.body.className.replace(/ ?vk-controls/g, '');",
  "    }, 3500);",
  "  }",
  "",
  "  /* --------------------------------- fullscreen -------------------------------- */",
  "  function isFs() {",
  "    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.webkitIsFullScreen);",
  "  }",
  "  function updateFs() {",
  "    var fs = isFs();",
  "    if (fs !== inFullscreen) { inFullscreen = fs; send('FULLSCREEN_CHANGED', { fullscreen: fs }); }",
  "  }",
  "  function enterFullscreen() {",
  "    var stage = qs('vk-stage');",
  "    var v = player.tech_ && player.tech_.el_ ? player.tech_.el_.querySelector('video') : null;",
  "    if (stage.requestFullscreen) stage.requestFullscreen();",
  "    else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();",
  "    else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();",
  "    else if (v && v.webkitRequestFullscreen) v.webkitRequestFullscreen();",
  "    if (screen.orientation && screen.orientation.lock) {",
  "      try { screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}",
  "    }",
  "    setTimeout(updateFs, 250);",
  "  }",
  "  function exitFullscreen() {",
  "    if (document.exitFullscreen) document.exitFullscreen();",
  "    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();",
  "    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}",
  "    setTimeout(updateFs, 250);",
  "  }",
  "  document.addEventListener('fullscreenchange', updateFs);",
  "  document.addEventListener('webkitfullscreenchange', updateFs);",
  "",
  "  /* ----------------------------------- bridge ---------------------------------- */",
  "  function receive(raw) {",
  "    var msg;",
  "    try { msg = JSON.parse(raw); } catch (e) { return; }",
  "    if (!msg || !msg.type) return;",
  "    if (!player) { pending.push(msg); return; }",
  "    switch (msg.type) {",
  "      case 'SET_SOURCE': applySource(msg.payload || {}); break;",
  "      case 'PLAY': { var p1 = player.play(); if (p1 && p1.catch) p1.catch(function(){}); break; }",
  "      case 'PAUSE': player.pause(); break;",
  "      case 'RETRY': if (currentSource) applySource(currentSource); break;",
  "      case 'EXIT_FULLSCREEN': exitFullscreen(); break;",
  "      case 'DESTROY': destroy(); break;",
  "      default: break;",
  "    }",
  "  }",
  "  var lastEvt = null;",
  "  function onBridgeMsg(evt) {",
  "    if (evt === lastEvt) return;",
  "    lastEvt = evt;",
  "    receive(evt.data);",
  "  }",
  "  document.addEventListener('message', onBridgeMsg); // Android",
  "  window.addEventListener('message', onBridgeMsg);   // iOS",
  "  window.__vkReceive = function (raw) { receive(raw); }; // RN injectJavaScript channel",
  "",
  "  function destroy() {",
  "    send('PLAYER_DESTROYED', {});",
  "    try { clearWatchdog(); if (player) player.dispose(); } catch (e) {}",
  "    player = null;",
  "  }",
  "  window.addEventListener('unload', function () {",
  "    try { if (player) { player.dispose(); player = null; } } catch (e) {}",
  "  });",
  "",
  "  try {",
  "    initPlayer();",
  "    bindControls();",
  "    send('PLAYER_READY', { vjsVersion: videojs.VERSION || '' });",
  "    var queued = pending; pending = [];",
  "    for (var i = 0; i < queued.length; i++) receive(JSON.stringify(queued[i]));",
  "  } catch (e) {",
  "    send('PLAYBACK_ERROR', { code: 0, message: 'Player init failed: ' + String(e).slice(0, 160) });",
  "  }",
  "})();",
].join("\n");
