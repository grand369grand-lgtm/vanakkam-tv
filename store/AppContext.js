/**
 * Global app state: loaded channels, active sources, favourites, watch history.
 * Kept in one small context so screens stay dumb and shareable.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseM3U, dedupe, categoriesOf } from "@/lib/m3u";
import { DEFAULT_SOURCES, loadSources } from "@/lib/playlists";
import { KEYS, load, save } from "@/lib/storage";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [channels, setChannels] = useState([]);
  const [activeSources, setActiveSources] = useState(DEFAULT_SOURCES);
  const [favorites, setFavorites] = useState([]); // channel ids
  const [recent, setRecent] = useState([]); // channel objects, newest first
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const byId = useRef(new Map());

  /* ---------------------------------------------------------------- hydrate */
  useEffect(() => {
    (async () => {
      const [fav, rec, src] = await Promise.all([
        load(KEYS.favorites, []),
        load(KEYS.recent, []),
        load(KEYS.sources, DEFAULT_SOURCES),
      ]);
      setFavorites(Array.isArray(fav) ? fav : []);
      setRecent(Array.isArray(rec) ? rec : []);
      setActiveSources(
        Array.isArray(src) && src.length ? src : DEFAULT_SOURCES,
      );
      setHydrated(true);
    })();
  }, []);

  /* ------------------------------------------------------------------ fetch */
  const refresh = useCallback(async (sourceIds) => {
    setLoading(true);
    setErrors([]);
    const { channels: list, errors: errs } = await loadSources(
      sourceIds,
      parseM3U,
    );
    const clean = dedupe(list).sort((a, b) => a.name.localeCompare(b.name));
    byId.current = new Map(clean.map((c) => [c.id, c]));
    setChannels(clean);
    setErrors(errs);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    refresh(activeSources);
  }, [hydrated, activeSources, refresh]);

  /* --------------------------------------------------------------- mutations */
  const setSources = useCallback((ids) => {
    const next = ids.length ? ids : DEFAULT_SOURCES;
    setActiveSources(next);
    save(KEYS.sources, next);
  }, []);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [id, ...prev];
      save(KEYS.favorites, next);
      return next;
    });
  }, []);

  const pushRecent = useCallback((channel) => {
    setRecent((prev) => {
      const next = [channel, ...prev.filter((c) => c.id !== channel.id)].slice(
        0,
        30,
      );
      save(KEYS.recent, next);
      return next;
    });
  }, []);

  const getChannel = useCallback((id) => byId.current.get(id), []);

  /* ---------------------------------------------------------------- derived */
  const favoriteChannels = useMemo(
    () => favorites.map((id) => byId.current.get(id)).filter(Boolean),
    [favorites, channels],
  );

  const categories = useMemo(() => categoriesOf(channels), [channels]);

  const value = useMemo(
    () => ({
      channels,
      loading,
      errors,
      activeSources,
      setSources,
      refresh: () => refresh(activeSources),
      categories,
      favorites,
      favoriteChannels,
      toggleFavorite,
      isFavorite: (id) => favorites.includes(id),
      recent,
      pushRecent,
      getChannel,
    }),
    [
      channels,
      loading,
      errors,
      activeSources,
      setSources,
      refresh,
      categories,
      favorites,
      favoriteChannels,
      toggleFavorite,
      recent,
      pushRecent,
      getChannel,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
