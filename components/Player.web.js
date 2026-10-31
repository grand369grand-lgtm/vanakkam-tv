/**
 * Player (web)
 * ------------
 * Same Vanakkam TV shell and the same fallback state machine as the native
 * Player (components/Player.js + components/player/usePlayerController.js),
 * but the video runs directly on Video.js 8 in the DOM (no WebView), with
 * MSE/VHS on Chrome/Firefox/Edge and native HLS on Safari.
 *
 * Rounded corners are applied here (pure CSS on web — the Android warning
 * about rounded clipping only concerns native video surfaces).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VideoJsPlayer from "./VideoJsPlayer"; // resolves to VideoJsPlayer.web.js
import usePlayerController from "./player/usePlayerController";
import { PLAYER_EVENTS } from "./player/bridge";
import { categoryLabel } from "./player/error-handler";
import { colors } from "@/theme";

export default function Player({ channel, alternates = [] }) {
  const playerRef = useRef(null);
  const fullscreenRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sendCommand = useCallback((type, payload) => {
    playerRef.current?.send(type, payload);
  }, []);

  const ctrl = usePlayerController({ channel, alternates, sendCommand });

  const handleEvent = useCallback(
    (event) => {
      if (event.type === PLAYER_EVENTS.FULLSCREEN_CHANGED) {
        fullscreenRef.current = !!event.payload?.fullscreen;
        setIsFullscreen(fullscreenRef.current);
      }
      ctrl.onEvent(event);
    },
    [ctrl],
  );

  useEffect(
    () => () => {
      try {
        playerRef.current?.destroy?.();
      } catch (e) {}
    },
    [],
  );

  const retry = useCallback(() => ctrl.retryManual(), [ctrl]);
  const { phase, statusNote, finalError, attempts, attemptIdx, current } = ctrl;
  const fullOverlay = phase === "loading" && !finalError;

  return (
    <View style={styles.stage}>
      <VideoJsPlayer ref={playerRef} onEvent={handleEvent} style={styles.video} />

      {fullOverlay && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.hint}>
            {attempts.length > 1
              ? `Source ${attemptIdx + 1}/${attempts.length} · Connecting to ${current?.name ?? channel.name}…`
              : `Tuning in to ${current?.name ?? channel.name}…`}
          </Text>
          {statusNote ? <Text style={styles.note}>{statusNote}</Text> : null}
        </View>
      )}

      {phase === "buffering" && (
        <View style={styles.bufferChip} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.bufferText}>{statusNote || "Buffering…"}</Text>
        </View>
      )}

      {finalError && (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.errorTitle}>Stream not available</Text>
          <Text style={styles.hint}>{finalError.friendly}</Text>
          {attempts.length > 1 && (
            <Text style={styles.note}>
              Tried {attempts.length} source{attempts.length > 1 ? "s" : ""} for this
              channel ({categoryLabel(finalError.category)}). Public IPTV links change
              daily — pick another channel if this one stays down.
            </Text>
          )}
          <Pressable onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {isFullscreen ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
  },
  video: { ...StyleSheet.absoluteFillObject },
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
  note: {
    color: colors.textFaint,
    fontSize: 11.5,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: "92%",
  },
  bufferChip: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(10,11,18,0.72)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  bufferText: { color: colors.textMuted, fontSize: 11.5 },
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
