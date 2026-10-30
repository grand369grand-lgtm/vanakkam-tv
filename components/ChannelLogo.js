/**
 * ChannelLogo
 * -----------
 * Remote logos are erratic: missing, 404, slow, or non-square. This component
 * shows a tinted monogram immediately and fades the real logo in on top when
 * it loads, so the grid never looks broken.
 */
import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { tintFor } from "@/theme";

export function initialsOf(name = "") {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "TV";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function ChannelLogo({ channel, size = 52, radius }) {
  const [failed, setFailed] = useState(false);
  const tint = tintFor(channel.categories);
  const br = radius ?? Math.round(size * 0.28);
  const showImage = channel.logo && !failed;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: br,
          backgroundColor: `${tint}22`,
        },
      ]}
    >
      <Text style={[styles.initials, { color: tint, fontSize: size * 0.34 }]}>
        {initialsOf(channel.name)}
      </Text>
      {showImage ? (
        <Image
          source={{ uri: channel.logo }}
          style={[StyleSheet.absoluteFill, { borderRadius: br }]}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  initials: { fontWeight: "800", letterSpacing: 0.4 },
});
