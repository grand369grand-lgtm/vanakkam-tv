/**
 * Player (native: iOS / Android)
 * ------------------------------
 * Thin wrapper around expo-video's <VideoView> with what a live IPTV app needs:
 * loading state, retryable error state, autoplay, native controls
 * (fullscreen / PiP where the platform supports it).
 *
 * Layout note: we deliberately do NOT wrap the <VideoView> in a `borderRadius`
 * + `overflow: hidden` container — on Android that combination can stop the
 * surface from rendering. The rounded look is applied on web only
 * (components/Player.web.js), where it's just CSS.
 *
 * The inner component is keyed on the stream url, so switching channels always
 * builds a fresh native player instead of reusing a broken one.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "@/theme";

function PlayerInner({ channel, onError }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [message, setMessage] = useState("");
  const startedAt = useRef(Date.now());

  const player = useVideoPlayer(
    {
      uri: channel.url,
      // Some IPTV CDNs only answer when the player sends a browser-ish UA.
      headers: {
        ...(channel.userAgent ? { "User-Agent": channel.userAgent } : {}),
        ...(channel.referrer ? { Referer: channel.referrer } : {}),
      },
    },
    (p) => {
      p.loop = false;
      p.play();
    },
  );

  useEffect(() => {
    const subs = [
      player.addListener("statusChange", (e) => {
        if (e.status === "readyToPlay") setStatus("ready");
        if (e.status === "error") {
          setStatus("error");
          setMessage(e.error?.message || "Stream unavailable");
          onError?.(e.error?.message || "Stream unavailable");
        }
      }),
    ];

    // Live HLS often buffers for a while before it reports ready — give up
    // gracefully after 20s instead of spinning forever.
    const watchdog = setTimeout(() => {
      setStatus((s) => {
        if (s !== "loading") return s;
        setMessage("No response after 20s");
        return "error";
      });
    }, 20000);

    return () => {
      clearTimeout(watchdog);
      subs.forEach((s) => s?.remove?.());
    };
  }, [player, onError]);

  const retry = useCallback(() => {
    setStatus("loading");
    setMessage("");
    startedAt.current = Date.now();
    try {
      player.replace({ uri: channel.url });
      player.play();
    } catch {
      setStatus("error");
    }
  }, [player, channel.url]);

  return (
    <View style={styles.stage}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />

      {status === "loading" && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.hint}>Connecting to {channel.name}…</Text>
        </View>
      )}

      {status === "error" && (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Stream not available</Text>
          <Text style={styles.hint}>
            {message || "This public stream may be offline or geo-blocked."}
            {"\n"}Try another channel — links change daily.
          </Text>
          <Pressable onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function Player({ channel, onError }) {
  return <PlayerInner key={channel.url} channel={channel} onError={onError} />;
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  retry: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  retryText: { color: "#12141F", fontWeight: "800", fontSize: 13 },
});
