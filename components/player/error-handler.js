/**
 * Error categorisation for the Vanakkam TV player.
 * -------------------------------------------------
 * Turns raw player/XHR errors into a stable category + a friendly message.
 *
 * IMPORTANT (product rule): a 403/401 stream CANNOT be fixed by changing the
 * player. The provider requires authentication or blocks this region/app —
 * the message says so honestly and points the user to another source. We do
 * not bypass DRM, stream authorization or geo-restrictions, and we never
 * expose tokens or credentials in messages or logs.
 */

export const ERROR_CATEGORIES = {
  AUTH: "AUTH", // 401/403 — provider auth or access control
  NOT_FOUND: "NOT_FOUND", // 404 — dead link
  SERVER: "SERVER", // 5xx — server-side failure
  MANIFEST: "MANIFEST", // HLS manifest missing/malformed
  SSL: "SSL", // broken/expired certificate, TLS protocol error
  NETWORK: "NETWORK", // unreachable host, timeout, offline
  CORS: "CORS", // web-only cross-origin block
  UNSUPPORTED: "UNSUPPORTED", // codec/container the device can't play
  DECODE: "DECODE", // media decode failure mid-stream
  UNKNOWN: "UNKNOWN",
};

/** Categories where retrying the same url is pointless for this session. */
export const PERMANENT_CATEGORIES = new Set([
  ERROR_CATEGORIES.AUTH,
  ERROR_CATEGORIES.NOT_FOUND,
  ERROR_CATEGORIES.UNSUPPORTED,
  ERROR_CATEGORIES.DECODE,
]);

/**
 * @param {object} raw  { code?, message?, httpStatus?, platform? }
 * @returns {{category: string, friendly: string, technical: string}}
 */
export function categorizeError(raw = {}) {
  const code = Number(raw.code) || 0;
  const status = Number(raw.httpStatus) || 0;
  const message = String(raw.message || "");
  const platform = raw.platform || "";
  const hay = `${message}`.toLowerCase();

  const mk = (category, friendly) => ({
    category,
    friendly,
    technical: message,
  });

  // 1. HTTP status first — most specific signal.
  if (status === 401 || status === 403) {
    return mk(
      ERROR_CATEGORIES.AUTH,
      "The server refused access (403/401). This provider requires authentication or blocks this app/region — this cannot be fixed in the player. Try another source or channel.",
    );
  }
  if (status === 404 || /404|filenotfound|not found/i.test(message)) {
    return mk(
      ERROR_CATEGORIES.NOT_FOUND,
      "This stream link is dead (404). Public IPTV links change daily — try another source.",
    );
  }
  if (status >= 500) {
    return mk(
      ERROR_CATEGORIES.SERVER,
      "The stream server is having problems (5xx). It may recover — try again later or pick another channel.",
    );
  }

  // 2. SSL / certificate failures.
  if (
    /ssl|handshake|certificate|trust anchor|protocol error|sslerror/i.test(hay) ||
    code === -1200
  ) {
    return mk(
      ERROR_CATEGORIES.SSL,
      "The stream server's HTTPS certificate is broken. This is a problem on the provider's side, not on your device.",
    );
  }

  // 3. CORS (web only).
  if (/cors|cross-origin/i.test(hay) || (platform === "web" && /networkerror/i.test(hay))) {
    return mk(
      ERROR_CATEGORIES.CORS,
      "The stream server does not allow browser playback (CORS). The same channel may work in the mobile app.",
    );
  }

  // 4. Manifest problems.
  if (
    /manifest|mpegurl|playlist|m3u8|parse error|invalid .* segment|hls error/i.test(hay) ||
    /manifestParsingError|manifestLoadError/i.test(message)
  ) {
    return mk(
      ERROR_CATEGORIES.MANIFEST,
      "The stream's playlist (HLS manifest) could not be loaded or parsed. The link may be offline or no longer valid.",
    );
  }

  // 5. Timeouts / offline / reachability.
  if (
    /timed?\s?-?out|timeout|etimedout|econnrefused|econnreset|enotfound|unknownhost|unable to resolve|no address|offline|network request failed|failed to connect|intervention.*timeout/i.test(
      hay,
    )
  ) {
    return mk(
      ERROR_CATEGORIES.NETWORK,
      "The stream server did not respond in time. It may be offline, slow, or geo-blocked by the provider.",
    );
  }

  // 6. Unsupported / decode.
  if (
    code === 4 ||
    /srcnotsupported|demuxer|codec|unsupported|no supported source/i.test(hay)
  ) {
    return mk(
      ERROR_CATEGORIES.UNSUPPORTED,
      "This stream uses a format this device cannot decode.",
    );
  }
  if (code === 3 || /decode|demux/i.test(hay)) {
    return mk(
      ERROR_CATEGORIES.DECODE,
      "The stream was interrupted by a decoding error. The broadcast may be corrupted or too heavy for this connection.",
    );
  }

  // 7. Everything else network-ish (ExoPlayer/media codes 1-2 and text).
  if (code === 1 || code === 2 || /network|connection|interrupted/i.test(hay)) {
    return mk(
      ERROR_CATEGORIES.NETWORK,
      "The connection to the stream failed. Check your internet — the source may also be offline or geo-blocked.",
    );
  }

  return mk(ERROR_CATEGORIES.UNKNOWN, message || "The stream could not be played.");
}

/** Map an internal category to a short status chip text. */
export function categoryLabel(category) {
  switch (category) {
    case ERROR_CATEGORIES.AUTH:
      return "Access denied (403/401)";
    case ERROR_CATEGORIES.NOT_FOUND:
      return "Dead link (404)";
    case ERROR_CATEGORIES.SERVER:
      return "Server error (5xx)";
    case ERROR_CATEGORIES.MANIFEST:
      return "Bad manifest";
    case ERROR_CATEGORIES.SSL:
      return "Broken HTTPS";
    case ERROR_CATEGORIES.CORS:
      return "Browser blocked (CORS)";
    case ERROR_CATEGORIES.UNSUPPORTED:
      return "Unsupported format";
    case ERROR_CATEGORIES.DECODE:
      return "Decode error";
    case ERROR_CATEGORIES.NETWORK:
      return "Network timeout";
    default:
      return "Playback error";
  }
}
