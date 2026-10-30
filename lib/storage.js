/**
 * Tiny persistent key/value store on top of AsyncStorage, with an in-memory
 * fallback so the app still works if the storage module is unavailable
 * (e.g. in a plain web preview).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function load(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function save(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export const KEYS = {
  favorites: "@vanakkam/favorites",
  recent: "@vanakkam/recent",
  sources: "@vanakkam/sources",
};
