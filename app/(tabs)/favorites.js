/**
 * Favourites — starred channels plus a short "recently watched" rail.
 * Favourites are stored as channel ids and re-resolved from the loaded
 * channels, so a channel that disappears from the playlists simply drops out.
 */
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChannelCard from "@/components/ChannelCard";
import EmptyState from "@/components/EmptyState";
import { useApp } from "@/store/AppContext";
import { colors } from "@/theme";

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteChannels, recent, toggleFavorite, isFavorite } = useApp();

  const open = (c) =>
    router.push({ pathname: "/watch", params: { payload: JSON.stringify(c) } });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.title}>Favourites</Text>
      <Text style={styles.sub}>
        {favoriteChannels.length} saved · {recent.length} recently watched
      </Text>

      <FlatList
        data={favoriteChannels}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 28,
        }}
        renderItem={({ item }) => (
          <ChannelCard
            channel={item}
            onPress={() => open(item)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            isFavorite={isFavorite(item.id)}
          />
        )}
        ListHeaderComponent={
          recent.length ? (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.sectionTitle}>Recently watched</Text>
              {recent.slice(0, 3).map((c) => (
                <ChannelCard
                  key={`r-${c.id}`}
                  compact
                  channel={c}
                  onPress={() => open(c)}
                  onToggleFavorite={() => toggleFavorite(c.id)}
                  isFavorite={isFavorite(c.id)}
                />
              ))}
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                Your list
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title="No favourites yet"
            message="Tap the star on any channel to pin it here."
            actionLabel="Browse channels"
            onAction={() => router.push("/")}
          />
        }
      />
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
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
});
