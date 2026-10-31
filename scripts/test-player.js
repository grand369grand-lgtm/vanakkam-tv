/**
 * Dependency-free test suite for the Vanakkam TV player modules.
 * Run: npm test   (uses @babel/core, already present, to load ESM sources)
 *
 * Covers the logic that runs on every device:
 *   - bridge: fallback attempt building (no HTTPS->HTTP rewriting), failure
 *     memory rules, header sanitisation, stream type detection
 *   - error-handler: HTTP/SSL/CORS/timeout/manifest categorisation with the
 *     honest "403 cannot be fixed in the player" messaging
 *   - playerTemplate: generated WebView page integrity
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const babel = require("@babel/core");

const ROOT = path.join(__dirname, "..");
// Compiled modules are written inside the repo so that @babel/runtime resolves.
const tmp = path.join(ROOT, ".test-build");
fs.mkdirSync(tmp, { recursive: true });

function load(rel) {
  const src = path.join(ROOT, rel);
  const out = babel.transformFileSync(src, {
    cwd: ROOT,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
    compact: false,
  }).code;
  const file = path.join(tmp, rel); // preserve structure: relative requires resolve
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  return require(file);
}

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) {
    passed++;
    console.log("  ok  -", name);
  } else {
    failed++;
    console.error("  FAIL -", name);
  }
}
function eq(a, b, name) {
  ok(a === b, `${name} (${JSON.stringify(a)} === ${JSON.stringify(b)})`);
}
function section(t) {
  console.log("\n" + t);
}

/* ------------------------------------------------------------------ bridge */
const bridge = load("components/player/bridge.js");

section("bridge.buildAttempts");
const primary = { id: "c1", url: "https://a/stream.m3u8", name: "Sun TV", tvgId: "SunTV.in" };
const alts = [
  { id: "c1b", url: "https://b/stream.m3u8", name: "Sun TV (720p)", tvgId: "SunTV.in" },
  { id: "c1c", url: "https://a/stream.m3u8", name: "Sun TV dup" }, // duplicate url
  { id: "c1d", url: "https://c/stream.m3u8", name: "Sun TV" },
  { id: "c1e", url: "https://d/stream.m3u8", name: "Sun TV" },
  { id: "c1f", url: "https://e/stream.m3u8", name: "Sun TV" }, // beyond max
];
const attempts = bridge.buildAttempts(primary, alts);
eq(attempts.length, bridge.FALLBACK_CONFIG.MAX_ATTEMPTS, "caps at MAX_ATTEMPTS");
eq(attempts[0].url, "https://a/stream.m3u8", "primary first");
ok(attempts.every((a) => /^https:\/\//.test(a.url)), "no automatic HTTPS->HTTP downgrade");
ok(new Set(attempts.map((a) => a.url)).size === attempts.length, "urls deduplicated");
ok(bridge.buildAttempts(null, alts).length === 0, "no attempts without a primary url");
eq(bridge.buildAttempts(primary, []).length, 1, "primary alone -> single attempt");

section("bridge.createFailureMemory");
const mem = bridge.createFailureMemory();
mem.remember("https://x/1.m3u8", "AUTH");
ok(mem.isBlocked("https://x/1.m3u8"), "AUTH (permanent) is blocked");
mem.remember("https://x/2.m3u8", "NETWORK");
ok(mem.isBlocked("https://x/2.m3u8"), "NETWORK blocked within cooldown");
mem.clear(["https://x/2.m3u8"]);
ok(!mem.isBlocked("https://x/2.m3u8"), "manual clear unblocks transient");
ok(mem.isBlocked("https://x/1.m3u8"), "clear only touches given urls");

section("bridge.sanitizeHeaders / streamType");
const sh = bridge.sanitizeHeaders({
  "User-Agent": "X", Referer: "y", "X-Custom": "keep", Cookie: "no",
});
eq(sh["User-Agent"], undefined, "User-Agent stripped (browser-forbidden)");
eq(sh.Referer, undefined, "Referer stripped");
eq(sh["X-Custom"], "keep", "custom header kept");
eq(sh.Cookie, undefined, "Cookie stripped");
eq(bridge.streamType("https://a/x.m3u8?tok=1"), "application/x-mpegURL", "m3u8 detected");
eq(bridge.streamType("https://a/video.mp4"), undefined, "mp4 left to sniffing");

/* ----------------------------------------------------------- error-handler */
const eh = load("components/player/error-handler.js");

section("error-handler.categorizeError");
const cases = [
  [{ httpStatus: 403 }, eh.ERROR_CATEGORIES.AUTH],
  [{ httpStatus: 401 }, eh.ERROR_CATEGORIES.AUTH],
  [{ httpStatus: 404 }, eh.ERROR_CATEGORIES.NOT_FOUND],
  [{ httpStatus: 500 }, eh.ERROR_CATEGORIES.SERVER],
  [{ message: "SSLHandshakeException: Failure in SSL library, usually a protocol error" }, eh.ERROR_CATEGORIES.SSL],
  [{ message: "CORS policy blocked", platform: "web" }, eh.ERROR_CATEGORIES.CORS],
  [{ message: "Connection timed out" }, eh.ERROR_CATEGORIES.NETWORK],
  [{ message: "manifestParsingError" }, eh.ERROR_CATEGORIES.MANIFEST],
  [{ code: 4, message: "SRC_NOT_SUPPORTED" }, eh.ERROR_CATEGORIES.UNSUPPORTED],
  [{ code: 3, message: "decode error" }, eh.ERROR_CATEGORIES.DECODE],
];
for (const [raw, expected] of cases) {
  eq(eh.categorizeError(raw).category, expected, `category(${JSON.stringify(raw)})`);
}
const auth = eh.categorizeError({ httpStatus: 403 });
ok(/cannot be fixed in the player/i.test(auth.friendly), "403 message is honest about player limits");
ok(!/bypass|crack|hack/i.test(auth.friendly), "403 message never suggests bypassing auth");
ok(eh.categoryLabel("SSL").length > 3, "categoryLabel works");

/* ---------------------------------------------------------- playerTemplate */
const tpl = (function () {
  // compile videojs.source.js first: playerTemplate requires './videojs.source'
  load("components/player/videojs.source.js");
  return load("components/player/playerTemplate.js");
})();

section("playerTemplate.buildPlayerHtml");
const html = tpl.buildPlayerHtml({ debug: false });
ok(html.length > 600000, "page embeds Video.js source");
ok(html.includes("Video.js 8."), "Video.js dist present");
ok(html.includes("PLAYER_READY"), "bridge emits PLAYER_READY");
ok(html.includes("PLAYBACK_STARTED"), "bridge emits PLAYBACK_STARTED");
ok(html.includes("PLAYBACK_PAUSED"), "bridge emits PLAYBACK_PAUSED");
ok(html.includes("BUFFERING"), "bridge emits BUFFERING");
ok(html.includes("PLAYBACK_ERROR"), "bridge emits PLAYBACK_ERROR");
ok(html.includes("SOURCE_CHANGED"), "bridge emits SOURCE_CHANGED");
ok(html.includes("FULLSCREEN_CHANGED"), "bridge emits FULLSCREEN_CHANGED");
ok(html.includes("PLAYER_DESTROYED"), "bridge emits PLAYER_DESTROYED");
ok(html.includes("__vkReceive"), "RN->page command channel present");
ok(html.includes("vk-live"), "LIVE badge present");
ok(html.includes("requestFullscreen") || html.includes("webkitRequestFullscreen"),
  "fullscreen supported");
ok(html.includes("webkitEnterFullscreen"), "iOS native HLS fullscreen path present");
ok(html.includes("vk-spin") || html.includes("vk-spinner"), "loading indicator present");
ok(html.includes("reconnecting"), "auto-reconnect UI present");
ok(html.indexOf("<script>") !== -1, "script blocks exist");
// The videojs source must not close the tag early (guarded, double-check here).
const inlineScript = html.split("<script>")[1];
ok(inlineScript && inlineScript.indexOf("</script>") > 500000, "videojs script block intact");
ok(html.split("<script>").length === 3, "exactly two script blocks (videojs + page)");

/* ------------------------------------------------------------------ result */
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
