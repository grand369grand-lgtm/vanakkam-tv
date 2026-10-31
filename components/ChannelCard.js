/**
 * ChannelCard — one row in a list. Logo, name, category chips, quality badge,
 * favourite toggle and a live dot. Works for both the browse list and search.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChannelLogo from "./ChannelLogo";
import { colors, radius } from "@/theme";

export default function ChannelCard({
  channel,
  onPress,
  onToggleFavorite,
  isFavorite,
  compact,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      android_ripple={{ color: "rgba(255,255,255,0.06)" }}
    >
      <ChannelLogo channel={channel} size={compact ? 44 : 52} />

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.name}>
          {channel.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.liveDot} />
          <Text numberOfLines={1} style={styles.meta}>
            {channel.categories.slice(0, 2).join(" · ")}
            {channel.quality ? `  ·  ${channel.quality}` : ""}
            {channel.isHls ? "  ·  HLS" : ""}
          </Text>
        </View>
      </View>

      <Pressable
        hitSlop={10}
        onPress={onToggleFavorite}
        style={styles.favBtn}
        accessibilityLabel={
          isFavorite ? "Remove from favourites" : "Add to favourites"
        }
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={19}
          color={isFavorite ? colors.accent : colors.textFaint}
        />
      </Pressable>
      <Ionicons name="play-circle" size={26} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  pressed: {
    backgroundColor: colors.cardPressed,
    transform: [{ scale: 0.995 }],
  },
  body: { flex: 1, gap: 4 },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  meta: { color: colors.textMuted, fontSize: 11.5, flex: 1 },
  favBtn: { padding: 4 },
});
