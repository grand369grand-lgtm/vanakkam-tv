/**
 * CategoryChips — horizontal, scrollable filter pills used above the channel
 * list. Selected pill is filled with the accent colour.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/theme";

export default function CategoryChips({ items, value, onChange, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {items.map((item) => {
        const active = value === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => onChange(active ? null : item.name)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {item.name}
            </Text>
            {item.count != null && (
              <View style={[styles.count, active && styles.countActive]}>
                <Text
                  style={[styles.countText, active && styles.countTextActive]}
                >
                  {item.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.textMuted, fontSize: 12.5, fontWeight: "700" },
  labelActive: { color: "#12141F" },
  count: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  countActive: { backgroundColor: "rgba(0,0,0,0.16)" },
  countText: { color: colors.textFaint, fontSize: 10, fontWeight: "800" },
  countTextActive: { color: "#12141F" },
});
