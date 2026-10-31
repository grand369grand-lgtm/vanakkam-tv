/**
 * Search — debounce-free live filtering over the loaded channels (a few
 * thousand strings, so filtering per keystroke is cheap).
 */
import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChannelCard from "@/components/ChannelCard";
import EmptyState from "@/components/EmptyState";
import { useApp } from "@/store/AppContext";
import { searchChannels } from "@/lib/m3u";
import { colors, radius } from "@/theme";

const SUGGESTIONS = [
  "Sun TV",
  "News",
  "Sports",
  "Music",
  "Devotional",
  "Movies",
  "Kids",
];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { channels, toggleFavorite, isFavorite } = useApp();
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchChannels(channels, query).slice(0, 300),
    [channels, query],
  );

  const open = (c) =>
    router.push({ pathname: "/watch", params: { payload: JSON.stringify(c) } });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.sub}>
        Across {channels.length.toLocaleString()} loaded channels
      </Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Channel, category or tvg-id…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Ionicons
            name="close-circle"
            size={17}
            color={colors.textFaint}
            onPress={() => setQuery("")}
          />
        )}
      </View>

      {!query && (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Text key={s} onPress={() => setQuery(s)} style={styles.chip}>
              {s}
            </Text>
          ))}
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 28,
          paddingTop: 8,
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ChannelCard
            channel={item}
            onPress={() => open(item)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            isFavorite={isFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={query ? "No match" : "Start typing"}
            message={
              query
                ? `Nothing matched “${query}”. Try a shorter word, or add more playlists in Settings.`
                : "Search by channel name, language, or category."
            }
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 14.5 },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
});
