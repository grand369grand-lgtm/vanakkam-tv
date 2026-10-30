/**
 * Settings — pick which iptv-org playlists feed the app.
 *
 * Tamil is preselected on first launch. Users can add Hindi/Telugu/category or
 * country playlists, or the whole ~11k-channel index at once. Selection is
 * persisted, so the choice survives a restart.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/store/AppContext";
import { SOURCES, DEFAULT_SOURCES } from "@/lib/playlists";
import { colors, radius } from "@/theme";

const ICONS = {
  language: "language-outline",
  category: "grid-outline",
  country: "globe-outline",
  all: "earth-outline",
};

const GROUPS = [
  { key: "language", title: "Languages", note: "Default: Tamil" },
  { key: "category", title: "Categories" },
  { key: "country", title: "Countries" },
  { key: "all", title: "Everything" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { activeSources, setSources, loading, channels, errors, refresh } =
    useApp();
  const [draft, setDraft] = useState(activeSources);
  const [applying, setApplying] = useState(false);

  const dirty = useMemo(
    () => [...draft].sort().join("|") !== [...activeSources].sort().join("|"),
    [draft, activeSources],
  );

  const toggle = (id) =>
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const apply = () => {
    setApplying(true);
    setSources(draft);
    setTimeout(() => setApplying(false), 600);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Choose the playlists that power the app</Text>

        <View style={styles.statCard}>
          <Stat
            label="Channels loaded"
            value={channels.length.toLocaleString()}
          />
          <Stat label="Active playlists" value={String(activeSources.length)} />
          <Stat
            label="Failed"
            value={String(errors.length)}
            danger={errors.length > 0}
          />
        </View>

        {errors.length > 0 && (
          <Pressable onPress={refresh} style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>
              {errors.length} playlist{errors.length > 1 ? "s" : ""} failed to
              load — tap to retry
            </Text>
          </Pressable>
        )}

        {GROUPS.map((g) => (
          <View key={g.key} style={{ marginTop: 18 }}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              {g.note ? <Text style={styles.groupNote}>{g.note}</Text> : null}
            </View>
            {SOURCES.filter((s) => s.kind === g.key).map((s) => {
              const on = draft.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
                  style={styles.row}
                >
                  <Ionicons
                    name={ICONS[s.kind] || "tv-outline"}
                    size={17}
                    color={on ? colors.accent : colors.textFaint}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{s.label}</Text>
                    {s.hint ? (
                      <Text style={styles.rowHint}>{s.hint}</Text>
                    ) : null}
                  </View>
                  <Toggle on={on} />
                </Pressable>
              );
            })}
          </View>
        ))}

        <Pressable
          onPress={() => {
            setDraft(DEFAULT_SOURCES);
          }}
          style={styles.ghostBtn}
        >
          <Ionicons name="refresh-outline" size={15} color={colors.textMuted} />
          <Text style={styles.ghostText}>Reset to Tamil only</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Playlists are fetched live from iptv-org/iptv (GitHub Pages). Nothing
          is bundled, so channel lists stay current automatically.
        </Text>
      </ScrollView>

      {dirty && (
        <Pressable
          onPress={apply}
          style={[styles.applyBar, { paddingBottom: insets.bottom + 12 }]}
        >
          {applying && loading ? (
            <ActivityIndicator color="#12141F" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={17} color="#12141F" />
              <Text style={styles.applyText}>
                Apply {draft.length} playlist{draft.length > 1 ? "s" : ""}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Small custom switch — renders identically on iOS, Android and web. */
function Toggle({ on }) {
  return (
    <View style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

function Stat({ label, value, danger }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statValue, danger && { color: colors.danger }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    paddingHorizontal: 16,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 16,
    marginTop: 3,
  },
  statCard: {
    flexDirection: "row",
    margin: 16,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 10.5, marginTop: 2 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,93,93,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,93,93,0.28)",
  },
  errorText: { color: colors.danger, fontSize: 12, flex: 1 },
  groupHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  groupNote: { color: colors.textFaint, fontSize: 11 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 16 },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: "#2A2E3F",
    justifyContent: "center",
  },
  trackOn: { backgroundColor: colors.accentDeep },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#8A90A6",
  },
  knobOn: { backgroundColor: colors.accent, alignSelf: "flex-end" },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  rowHint: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 22,
    marginHorizontal: 16,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  footnote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  applyBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  applyText: { color: "#12141F", fontSize: 14, fontWeight: "800" },
});
