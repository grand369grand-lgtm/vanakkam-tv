/**
 * Player (native: iOS / Android)
 * ------------------------------
 * Vanakkam TV player shell on top of the WebView + Video.js 8 stack.
 *
 * Responsibilities:
 *  - render <VideoJsPlayer> (one persistent WebView, sources switched in-place)
 *  - run the shared fallback state machine (components/player/usePlayerController):
 *    on failure, try the next authorized source of the SAME channel; never
 *    auto-downgrade HTTPS; never hammer permanently-dead sources
 *  - show Vanakkam TV dark-cinema overlays: connecting spinner, buffering,
 *    LIVE status (inside page), honest error screens with a Retry button
 *  - Android hardware back: exit in-page fullscreen first, then navigate
 *  - release the native player (PLAYER_DESTROYED) when unmounting
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VideoJsPlayer from "./VideoJsPlayer";
import usePlayerController from "./player/usePlayerController";
import { PLAYER_EVENTS } from "./player/bridge";
import { categoryLabel } from "./player/error-handler";
import { colors } from "@/theme";

export default function Player({ channel, alternates = [] }) {
  const playerRef = useRef(null);
  const fullscreenRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /** Commands from the controller go into the WebView player. */
  const sendCommand = useCallback((type, payload) => {
    playerRef.current?.send(type, payload);
  }, []);

  const ctrl = usePlayerController({ channel, alternates, sendCommand });

  /** Intercept bridge events we need locally, then feed the controller. */
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

  // Release the native player when leaving the screen.
  useEffect(
    () => () => {
      try {
        playerRef.current?.destroy?.();
      } catch (e) {}
    },
    [],
  );

  // Android hardware back: first exit fullscreen, otherwise navigate back.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (fullscreenRef.current) {
        playerRef.current?.send("EXIT_FULLSCREEN");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const retry = useCallback(() => ctrl.retryManual(), [ctrl]);
  const { phase, statusNote, finalError, attempts, attemptIdx, current } = ctrl;
  const showLoading = phase === "loading" || phase === "buffering";
  const fullOverlay = phase === "loading" && !finalError;

  return (
    <View style={styles.stage}>
      <VideoJsPlayer ref={playerRef} onEvent={handleEvent} style={styles.video} />

      {/* connecting / switching source */}
      {fullOverlay && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.hint}>
            {attempts.length > 1
              ? `Source ${attemptIdx + 1}/${attempts.length} · Connecting to ${current?.name ?? channel.name}…`
              : `Connecting to ${current?.name ?? channel.name}…`}
          </Text>
          {statusNote ? <Text style={styles.note}>{statusNote}</Text> : null}
        </View>
      )}

      {/* buffering while already playing: small chip, video stays visible */}
      {phase === "buffering" && (
        <View style={styles.bufferChip} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.bufferText}>{statusNote || "Buffering…"}</Text>
        </View>
      )}

      {/* final error after every authorized source failed */}
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

      {/* subtle live hint in normal mode is rendered inside the page controls */}
      {isFullscreen && !finalError && !fullOverlay ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    justifyContent: "center",
    overflow: "hidden",
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
