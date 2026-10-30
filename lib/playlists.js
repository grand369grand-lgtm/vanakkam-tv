/**
 * Playlist sources.
 *
 * Every file here is produced daily by the iptv-org bot:
 *   https://github.com/iptv-org/iptv
 *   https://iptv-org.github.io/iptv/...
 *
 * Nothing is bundled with the app — playlists are fetched at runtime, which
 * keeps the app tiny and always fresh. Swap `IPTV_BASE` for a self-hosted
 * mirror if GitHub Pages is blocked on your network.
 */

export const IPTV_BASE = "https://iptv-org.github.io/iptv";

/**
 * The Tamil playlist is the app's default home feed.
 * `default: true` marks the sources that are loaded on first launch.
 */
export const SOURCES = [
  {
    id: "lang-tam",
    label: "Tamil",
    sublabel: "தமிழ்",
    kind: "language",
    url: `${IPTV_BASE}/languages/tam.m3u`,
    emoji: "🇮🇳",
    default: true,
  },
  {
    id: "lang-hin",
    label: "Hindi",
    kind: "language",
    url: `${IPTV_BASE}/languages/hin.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "lang-tel",
    label: "Telugu",
    kind: "language",
    url: `${IPTV_BASE}/languages/tel.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "lang-mal",
    label: "Malayalam",
    kind: "language",
    url: `${IPTV_BASE}/languages/mal.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "lang-kan",
    label: "Kannada",
    kind: "language",
    url: `${IPTV_BASE}/languages/kan.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "lang-ben",
    label: "Bengali",
    kind: "language",
    url: `${IPTV_BASE}/languages/ben.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "lang-mar",
    label: "Marathi",
    kind: "language",
    url: `${IPTV_BASE}/languages/mar.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "lang-urd",
    label: "Urdu",
    kind: "language",
    url: `${IPTV_BASE}/languages/urd.m3u`,
    emoji: "🇵🇰",
  },
  {
    id: "lang-ara",
    label: "Arabic",
    kind: "language",
    url: `${IPTV_BASE}/languages/ara.m3u`,
    emoji: "🌍",
  },
  {
    id: "lang-spa",
    label: "Spanish",
    kind: "language",
    url: `${IPTV_BASE}/languages/spa.m3u`,
    emoji: "🌍",
  },
  {
    id: "lang-fra",
    label: "French",
    kind: "language",
    url: `${IPTV_BASE}/languages/fra.m3u`,
    emoji: "🌍",
  },
  {
    id: "lang-eng",
    label: "English",
    kind: "language",
    url: `${IPTV_BASE}/languages/eng.m3u`,
    emoji: "🌍",
  },

  {
    id: "cat-news",
    label: "News",
    kind: "category",
    url: `${IPTV_BASE}/categories/news.m3u`,
    emoji: "📰",
  },
  {
    id: "cat-sports",
    label: "Sports",
    kind: "category",
    url: `${IPTV_BASE}/categories/sports.m3u`,
    emoji: "🏏",
  },
  {
    id: "cat-movies",
    label: "Movies",
    kind: "category",
    url: `${IPTV_BASE}/categories/movies.m3u`,
    emoji: "🎬",
  },
  {
    id: "cat-music",
    label: "Music",
    kind: "category",
    url: `${IPTV_BASE}/categories/music.m3u`,
    emoji: "🎵",
  },
  {
    id: "cat-kids",
    label: "Kids",
    kind: "category",
    url: `${IPTV_BASE}/categories/kids.m3u`,
    emoji: "🧸",
  },
  {
    id: "cat-docu",
    label: "Documentary",
    kind: "category",
    url: `${IPTV_BASE}/categories/documentary.m3u`,
    emoji: "🌏",
  },

  {
    id: "country-in",
    label: "India",
    kind: "country",
    url: `${IPTV_BASE}/countries/in.m3u`,
    emoji: "🇮🇳",
  },
  {
    id: "country-lk",
    label: "Sri Lanka",
    kind: "country",
    url: `${IPTV_BASE}/countries/lk.m3u`,
    emoji: "🇱🇰",
  },
  {
    id: "country-us",
    label: "USA",
    kind: "country",
    url: `${IPTV_BASE}/countries/us.m3u`,
    emoji: "🇺🇸",
  },
  {
    id: "country-gb",
    label: "UK",
    kind: "country",
    url: `${IPTV_BASE}/countries/gb.m3u`,
    emoji: "🇬🇧",
  },

  {
    id: "all",
    label: "Everything",
    kind: "all",
    url: `${IPTV_BASE}/index.m3u`,
    emoji: "🌐",
    hint: "~11,000 channels — slower to load",
  },
];

export const DEFAULT_SOURCES = ["lang-tam"];

export function sourceById(id) {
  return SOURCES.find((s) => s.id === id);
}

export function sourcesByIds(ids = []) {
  return ids.map(sourceById).filter(Boolean);
}

/**
 * Fetch + parse one or more sources. Failures are isolated: if one playlist
 * is unreachable the others still load.
 *
 * @param {string[]} ids
 * @param {(text: string, source: object) => any[]} parse
 * @returns {Promise<{ channels: any[], errors: {id: string, message: string}[] }>}
 */
export async function loadSources(ids, parse, { timeoutMs = 20000 } = {}) {
  const list = sourcesByIds(ids);
  const errors = [];
  const results = await Promise.all(
    list.map(async (src) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(src.url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return parse(text, { source: src.id });
      } catch (e) {
        errors.push({ id: src.id, message: e?.message || "Failed to load" });
        return [];
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return { channels: results.flat(), errors };
}
