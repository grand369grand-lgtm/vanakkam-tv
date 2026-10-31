/**
 * M3U / M3U8 playlist parser.
 *
 * The iptv-org playlists look like:
 *
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="SunTV.in@SD" tvg-logo="https://..." group-title="Entertainment",Sun TV (1080p)
 *   #EXTVLCOPT:http-user-agent=Mozilla/5.0 ...
 *   https://example.com/suntv/index.m3u8
 *
 * We turn each entry into a plain channel object that the UI can render and
 * the player can stream. No dependencies so it runs on web + native.
 */

/**
 * @typedef {Object} Channel
 * @property {string} id          stable id (tvg-id or url hash)
 * @property {string} name        clean display name, quality suffix removed
 * @property {string} url         stream url
 * @property {string} logo        logo url ('' when missing)
 * @property {string} tvgId       raw tvg-id attribute
 * @property {string[]} categories group-title split on ';'
 * @property {string} quality     '1080p' | '720p' | ... | ''
 * @property {string} userAgent   from http-user-agent / #EXTVLCOPT
 * @property {string} referrer    from http-referrer / #EXTVLCOPT
 * @property {boolean} isHls      url ends in .m3u8 (or clearly a manifest)
 * @property {string} source      which playlist it came from
 * @property {string} thumbnail   poster fallback (iptv-org logo proxy is unreliable → use logo)
 */

const ATTR_RE = /([a-zA-Z0-9-]+)="([^"]*)"/g;
const QUALITY_RE = /\s*\((\d{3,4}p)\)\s*$/i;

/** Parse a single #EXTINF attribute blob into an object. */
function parseAttrs(blob) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(blob)) !== null) {
    out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

/** Cheap, stable hash so duplicate URLs get the same id. */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function looksLikeHls(url) {
  const u = url.split("?")[0].toLowerCase();
  return (
    u.endsWith(".m3u8") ||
    u.includes("/playlist.") ||
    u.includes("master.m3u") ||
    u.includes("index.m3u8")
  );
}

/**
 * Parse raw playlist text into Channel[].
 * @param {string} text
 * @param {{ source?: string }} [opts]
 * @returns {Channel[]}
 */
export function parseM3U(text, opts = {}) {
  const source = opts.source || "iptv-org";
  if (typeof text !== "string" || !text.includes("#EXTM3U")) return [];

  const lines = text.split(/\r?\n/);
  const channels = [];

  let pending = null; // { attrs, title }
  const vlcOpts = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      // Everything after the first comma is the display title.
      const commaIdx = line.indexOf(",");
      const head = commaIdx === -1 ? line : line.slice(0, commaIdx);
      const title = commaIdx === -1 ? "" : line.slice(commaIdx + 1).trim();
      pending = { attrs: parseAttrs(head), title };
      for (const k of Object.keys(vlcOpts)) delete vlcOpts[k];
      continue;
    }

    if (line.startsWith("#EXTVLCOPT:")) {
      const opt = line.slice("#EXTVLCOPT:".length);
      const eq = opt.indexOf("=");
      if (eq > -1) vlcOpts[opt.slice(0, eq).toLowerCase()] = opt.slice(eq + 1);
      continue;
    }

    if (line.startsWith("#")) continue; // #EXTGRP, #EXTM3U, comments...

    if (!pending) continue;
    if (!/^https?:\/\//i.test(line)) {
      pending = null;
      continue;
    }

    const a = pending.attrs;
    let name = pending.title || a["tvg-name"] || "Unknown channel";
    let quality = "";
    const qm = name.match(QUALITY_RE);
    if (qm) {
      quality = qm[1].toLowerCase();
      name = name.replace(QUALITY_RE, "").trim();
    }

    const categories = (a["group-title"] || "Undefined")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    channels.push({
      id: a["tvg-id"] ? `${a["tvg-id"]}|${hash(line)}` : hash(line),
      name,
      url: line,
      logo: a["tvg-logo"] || "",
      tvgId: a["tvg-id"] || "",
      categories,
      quality,
      userAgent: vlcOpts["http-user-agent"] || a["http-user-agent"] || "",
      referrer: vlcOpts["http-referrer"] || a["http-referrer"] || "",
      isHls: looksLikeHls(line),
      source,
    });

    pending = null;
  }

  return channels;
}

/** Remove exact duplicate stream URLs, keeping the first occurrence. */
export function dedupe(channels) {
  const seen = new Set();
  const out = [];
  for (const c of channels) {
    const key = c.url.split("|")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Count channels per category, biggest first. */
export function categoriesOf(channels) {
  const map = new Map();
  for (const c of channels) {
    for (const cat of c.categories) {
      map.set(cat, (map.get(cat) || 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Simple fuzzy-ish search: every token must appear in name/brand/category. */
export function searchChannels(channels, query) {
  const q = query.trim().toLowerCase();
  if (!q) return channels;
  const tokens = q.split(/\s+/);
  return channels.filter((c) => {
    const hay = `${c.name} ${c.categories.join(" ")} ${c.tvgId}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}
