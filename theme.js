/**
 * Vanakkam TV — design tokens
 * A dark, high-contrast "cinema at night" palette with a marigold (Tamil flag
 * inspired) accent. Everything is plain JS so it can be reused in both
 * StyleSheet objects and inline styles.
 */

export const colors = {
  bg: "#0A0B12",
  bgElevated: "#12141F",
  card: "#161927",
  cardPressed: "#1F2333",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",

  text: "#F5F6FA",
  textMuted: "#9AA0B4",
  textFaint: "#6A7186",

  accent: "#FFB020", // marigold
  accentSoft: "rgba(255,176,32,0.14)",
  accentDeep: "#E08900",

  danger: "#FF5D5D",
  success: "#39D98A",
  live: "#FF3B5C",

  overlay: "rgba(5,6,12,0.72)",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = (n = 1) => n * 8;

export const type = {
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 21, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 14, fontWeight: "500" },
  small: { fontSize: 12, fontWeight: "500" },
  tiny: { fontSize: 11, fontWeight: "600" },
};

/** Distinct-ish colour per category, so poster tiles read fast. */
export const categoryTint = {
  News: "#FF3B5C",
  Entertainment: "#7C4DFF",
  Movies: "#FF8A3D",
  Music: "#22C1C3",
  Sports: "#39D98A",
  Kids: "#FFD166",
  Religious: "#C084FC",
  Documentary: "#38BDF8",
  General: "#94A3B8",
  Cooking: "#FB7185",
  Comedy: "#F59E0B",
  Lifestyle: "#F472B6",
  Business: "#60A5FA",
  Education: "#34D399",
  Family: "#A78BFA",
  Travel: "#2DD4BF",
  Culture: "#E879F9",
  Animation: "#FBBF24",
  Series: "#818CF8",
  Outdoor: "#4ADE80",
  Shop: "#FCA5A5",
  Undefined: "#64748B",
};

export function tintFor(categories = []) {
  for (const c of categories) {
    if (categoryTint[c]) return categoryTint[c];
  }
  return colors.accent;
}

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};
