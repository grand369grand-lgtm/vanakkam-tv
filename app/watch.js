/**
 * Watch — full-screen player route.
 *
 * Receives the channel as a JSON param (works on web and native, survives a
 * page reload on web). Below the player: channel meta, favourite button, and a
 * "Up next" list of sibling channels from the same category.
 */
import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Player from "@/components/Player";
import ChannelCard from "@/components/ChannelCard";
import ChannelLogo from "@/components/ChannelLogo";
import { useApp } from "@/store/AppContext";
import { colors, radius } from "@/theme";

/** Loose channel-name key so "Sun TV (1080p)" matches "Sun TV 720p" etc. */
function normalizeName(s = "") {
  return s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
}

export default function WatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { payload } = useLocalSearchParams();
  const { channels, toggleFavorite, isFavorite, pushRecent, recent } = useApp();

  const channel = useMemo(() => {
    if (!payload) return null;
    try {
      return JSON.parse(String(payload));
    } catch {
      return null;
    }
  }, [payload]);

  useEffect(() => {
    if (channel) pushRecent(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  const upNext = useMemo(() => {
    if (!channel) return [];
    const cat = channel.categories[0];
    const pool = channels.filter(
      (c) => c.id !== channel.id && c.categories.includes(cat),
    );
    return [
      ...recent
        .filter((c) => c.id !== channel.id && c.categories.includes(cat))
        .slice(0, 2),
      ...pool,
    ]
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
      .slice(0, 12);
  }, [channel, channels, recent]);

  // Alternate feeds of the SAME channel (same tvg-id or same name) found in
  // any loaded playlist. The player falls back to these automatically when
  // the primary link fails (broken SSL, dead link, geo-block…).
  const alternates = useMemo(() => {
    if (!channel) return [];
    const key = normalizeName(channel.name);
    return channels
      .filter((c) => c.id !== channel.id && c.url !== channel.url)
      .filter(
        (c) =>
          (channel.tvgId && c.tvgId && c.tvgId === channel.tvgId) ||
          (key && normalizeName(c.name) === key),
      )
      .slice(0, 2);
  }, [channel, channels]);

  if (!channel) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={{ color: colors.textMuted }}>No channel selected.</Text>
        <Pressable onPress={() => router.back()} style={styles.backPill}>
          <Text style={styles.backPillText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const fav = isFavorite(channel.id);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top > 0 ? insets.top + 6 : 28,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => toggleFavorite(channel.id)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons
              name={fav ? "star" : "star-outline"}
              size={20}
              color={fav ? colors.accent : colors.text}
            />
          </Pressable>
        </View>

        <View style={styles.playerWrap}>
          <Player channel={channel} alternates={alternates} />
        </View>

        <View style={styles.meta}>
          <ChannelLogo channel={channel} size={46} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={styles.title}>
              {channel.name}
            </Text>
            <Text style={styles.sub}>
              {channel.categories.join(" · ")}
              {channel.quality ? `  ·  ${channel.quality}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {channel.isHls && <Badge icon="radio-outline" text="HLS" />}
          {channel.quality ? (
            <Badge icon="videocam-outline" text={channel.quality} />
          ) : null}
          {channel.tvgId ? (
            <Badge icon="pricetag-outline" text={channel.tvgId.split("@")[0]} />
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>
          Up next in {channel.categories[0]}
        </Text>
        <View style={{ paddingHorizontal: 16 }}>
          {upNext.map((c) => (
            <ChannelCard
              key={c.id}
              compact
              channel={c}
              onPress={() =>
                router.replace({
                  pathname: "/watch",
                  params: { payload: JSON.stringify(c) },
                })
              }
              onToggleFavorite={() => toggleFavorite(c.id)}
              isFavorite={isFavorite(c.id)}
            />
          ))}
        </View>

        <Text style={styles.footnote}>
          Streams come from public iptv-org playlists. If this one is offline,
          try another channel — links change daily.
        </Text>
      </ScrollView>
    </View>
  );
}

function Badge({ icon, text }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  // The WebView player renders as a normal view, so rounded corners are safe
  // on every platform (the old native-surface clipping issue is gone).
  playerWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,59,92,0.14)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveText: {
    color: colors.live,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  meta: { flexDirection: "row", gap: 12, alignItems: "center", padding: 16 },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  footnote: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  backPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  backPillText: { color: "#12141F", fontWeight: "800" },
});
