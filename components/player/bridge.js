/**
 * Bridge protocol + shared playback logic for the Vanakkam TV player.
 * ---------------------------------------------------------------
 * This module is platform-neutral (no React Native imports) so the native
 * WebView player and the web player share the exact same rules:
 *
 *  - Event/command names for the RN <-> Video.js bridge
 *  - The ordered fallback "attempt list" for a channel
 *  - A session-scoped failure memory so permanently unavailable sources
 *    are not retried again and again
 *
 * Constraint from the product spec:
 *  - We NEVER auto-downgrade HTTPS to HTTP. If the playlist lists an http://
 *    url it is played as-is (cleartext is allowed by the manifest), but a
 *    failing https:// url is never rewritten to http://.
 */

/** Events sent FROM the player TO React Native. */
export const PLAYER_EVENTS = {
  PLAYER_READY: "PLAYER_READY",
  PLAYBACK_STARTED: "PLAYBACK_STARTED",
  PLAYBACK_PAUSED: "PLAYBACK_PAUSED",
  BUFFERING: "BUFFERING",
  PLAYBACK_ERROR: "PLAYBACK_ERROR",
  SOURCE_CHANGED: "SOURCE_CHANGED",
  RETRY_REQUESTED: "RETRY_REQUESTED",
  FULLSCREEN_CHANGED: "FULLSCREEN_CHANGED",
  PLAYER_DESTROYED: "PLAYER_DESTROYED",
  LOG: "LOG",
};

/** Commands sent FROM React Native TO the player. */
export const PLAYER_COMMANDS = {
  SET_SOURCE: "SET_SOURCE",
  PLAY: "PLAY",
  PAUSE: "PAUSE",
  RETRY: "RETRY",
  EXIT_FULLSCREEN: "EXIT_FULLSCREEN",
  DESTROY: "DESTROY",
};

/**
 * Tunable playback constants. `PER_ATTEMPT_TIMEOUT_MS` is the configurable
 * timeout for "connected but never started playing" before we fall back.
 */
export const FALLBACK_CONFIG = {
  MAX_ATTEMPTS: 4, // primary + up to 3 mirrors of the same channel
  PER_ATTEMPT_TIMEOUT_MS: 15000,
  PAGE_RECONNECT_TRIES: 3, // in-player auto-reconnect for mid-playback drops
  PAGE_RECONNECT_BASE_MS: 2000, // 2s, 4s, 6s
};

/**
 * Build the ordered attempt list for a channel.
 * Alternates MUST be the same channel (same tvg-id or same normalised name)
 * served from another URL. Unrelated channels are never treated as mirrors.
 *
 * @param {object} channel primary channel ({url, name, tvgId, ...})
 * @param {object[]} alternates same-channel mirrors
 * @returns {object[]} ordered attempts (url, name, userAgent?, referrer?)
 */
export function buildAttempts(channel, alternates = []) {
  if (!channel?.url) return [];
  const out = [channel];
  const seen = new Set([channel.url]);
  for (const alt of alternates || []) {
    if (out.length >= FALLBACK_CONFIG.MAX_ATTEMPTS) break;
    if (alt?.url && !seen.has(alt.url)) {
      out.push(alt);
      seen.add(alt.url);
    }
  }
  return out.slice(0, FALLBACK_CONFIG.MAX_ATTEMPTS);
}

/**
 * Session-scoped memory of failed source urls.
 *
 * Rules:
 *  - permanent categories (auth / not-found / unsupported) are remembered for
 *    the whole session -> fallback skips them instead of hammering dead doors
 *  - transient categories (network / timeout) are remembered briefly so an
 *    automatic cascade doesn't loop on them; manual retry clears them
 */
export function createFailureMemory() {
  const PERMANENT = new Set(["AUTH", "NOT_FOUND", "UNSUPPORTED", "DECODE"]);
  const TRANSIENT_TTL_MS = 3 * 60 * 1000; // 3 min cooldown
  const map = new Map(); // url -> { category, at, permanent }

  return {
    isBlocked(url) {
      const rec = map.get(url);
      if (!rec) return false;
      if (rec.permanent) return true;
      return Date.now() - rec.at < TRANSIENT_TTL_MS;
    },
    remember(url, category) {
      if (!url) return;
      map.set(url, {
        category: category || "UNKNOWN",
        at: Date.now(),
        permanent: PERMANENT.has(category),
      });
    },
    clear(urls) {
      for (const u of urls || []) map.delete(u);
    },
    clearAll() {
      map.clear();
    },
  };
}

/** Filter out browser-forbidden headers (User-Agent, Referer…). */
const FORBIDDEN_HEADERS = new Set([
  "user-agent",
  "referer",
  "host",
  "origin",
  "content-length",
  "cookie",
  "set-cookie",
  "connection",
]);

export function sanitizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (!FORBIDDEN_HEADERS.has(String(k).toLowerCase()) && v) out[k] = v;
  }
  return out;
}

/** Guess a stream type hint from the url (HLS manifest vs progressive). */
export function streamType(url = "") {
  const clean = String(url).split("?")[0].toLowerCase();
  if (
    clean.endsWith(".m3u8") ||
    clean.endsWith(".m3u") ||
    clean.includes("/playlist.") ||
    clean.includes("master.m3u")
  ) {
    return "application/x-mpegURL";
  }
  return undefined; // let Video.js sniff it
}
