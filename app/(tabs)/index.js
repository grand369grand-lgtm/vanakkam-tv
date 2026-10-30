/**
 * Live — the home screen.
 *
 * Layout (top → bottom):
 *   1. Header with brand + source count
 *   2. "Tamil first" hero: continue-watching / featured channel
 *   3. Category chips (auto-built from whatever playlists are loaded)
 *   4. Channel list
 *
 * Tamil is the default source (see lib/playlists.js) so this screen is Tamil
 * content on a cold start, with everything else one tap away in Settings.
 */
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/store/AppContext";
import ChannelCard from "@/components/ChannelCard";
import CategoryChips from "@/components/CategoryChips";
import EmptyState from "@/components/EmptyState";
import { colors, radius } from "@/theme";

export default function LiveScreen() {
  const router = useRouter();
  const {
    channels,
    categories,
    loading,
    errors,
    refresh,
    favoriteChannels,
    recent,
    toggleFavorite,
    isFavorite,
    activeSources,
  } = useApp();

  const [category, setCategory] = useState(null);

  const data = useMemo(() => {
    if (!category) return channels;
    return channels.filter((c) => c.categories.includes(category));
  }, [channels, category]);

  const hero = recent[0] || favoriteChannels[0] || channels[0] || null;

  const openChannel = (channel) =>
    router.push({
      pathname: "/watch",
      params: { payload: JSON.stringify(channel) },
    });

  if (!loading && channels.length === 0) {
    return (
      <View style={[styles.screen, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load any channels"
          message={
            errors.length
              ? `Playlist error: ${errors[0].message}`
              : "No sources selected. Pick a playlist in Settings."
          }
          actionLabel="Retry"
          onAction={refresh}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>
                  Vanakkam<Text style={{ color: colors.accent }}>TV</Text>
                </Text>
                <Text style={styles.sub}>
                  {loading
                    ? "Loading playlists…"
                    : `${channels.length.toLocaleString()} channels · ${activeSources.length} playlist${
                        activeSources.length > 1 ? "s" : ""
                      }`}
                </Text>
              </View>
              <Pressable
                style={styles.iconBtn}
                onPress={() => router.push("/settings")}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={colors.text}
                />
              </Pressable>
            </View>

            {hero && (
              <Pressable
                onPress={() => openChannel(hero)}
                style={({ pressed }) => [
                  styles.hero,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.heroGlow} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroKicker}>
                    {recent[0] ? "CONTINUE WATCHING" : "START HERE"}
                  </Text>
                  <Text numberOfLines={1} style={styles.heroTitle}>
                    {hero.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.heroSub}>
                    {hero.categories.join(" · ")}
                    {hero.quality ? `  ·  ${hero.quality}` : ""}
                  </Text>
                  <View style={styles.heroBtn}>
                    <Ionicons name="play" size={14} color="#12141F" />
                    <Text style={styles.heroBtnText}>Watch live</Text>
                  </View>
                </View>
                <Ionicons
                  name="tv-outline"
                  size={78}
                  color="rgba(255,176,32,0.16)"
                />
              </Pressable>
            )}

            <Text style={styles.sectionTitle}>Categories</Text>
            <CategoryChips
              items={[{ name: "All", count: channels.length }, ...categories]}
              value={category || "All"}
              onChange={(c) => setCategory(c === "All" ? null : c)}
              style={{ paddingBottom: 8 }}
            />
            <Text style={styles.sectionTitle}>
              {category ? category : "All channels"}{" "}
              <Text style={styles.count}>{data.length}</Text>
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <ChannelCard
              channel={item}
              onPress={() => openChannel(item)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              isFavorite={isFavorite(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="funnel-outline"
              title="Nothing in this category"
              message="Try another filter or add more playlists in Settings."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  listContent: { paddingBottom: 28 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 14,
    gap: 12,
  },
  brand: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,176,32,0.22)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accentSoft,
  },
  heroKicker: {
    color: colors.accent,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 5,
    letterSpacing: -0.4,
  },
  heroSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  heroBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  heroBtnText: { color: "#12141F", fontWeight: "800", fontSize: 12.5 },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  count: { color: colors.textFaint, fontWeight: "600", fontSize: 12.5 },
});
