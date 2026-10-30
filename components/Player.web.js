/**
 * Player (web)
 * ------------
 * On the web, expo-video falls back to a plain <video> element, which cannot
 * play HLS (.m3u8) in Chrome/Firefox/Edge. So the web build gets its own
 * player: hls.js for HLS streams, native <video> for MP4, plus a light
 * custom control bar (play/pause, mute, live badge, fullscreen).
 *
 * Native iOS/Android keep using components/Player.js (expo-video), which
 * handles HLS natively.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Hls from "hls.js";
import { colors } from "@/theme";

export default function Player({ channel }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [state, setState] = useState("loading"); // loading | playing | paused | error
  const [muted, setMuted] = useState(true); // browsers only autoplay muted
  const [message, setMessage] = useState("");

  /* ------------------------------------------------------------ attach src */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setState("loading");
    setMessage("");

    const isHls = channel.isHls;

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        manifestLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4,
      });
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setState("error");
          setMessage(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "Network/CORS error — this stream may be geo-blocked or offline."
              : "This stream could not be decoded.",
          );
        }
      });
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari plays HLS natively
      video.src = channel.url;
      video.play().catch(() => {});
    } else {
      video.src = channel.url;
      video.play().catch(() => {});
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load?.();
    };
  }, [channel.url, channel.isHls]);

  /* -------------------------------------------------------------- handlers */
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const retry = () => {
    const v = videoRef.current;
    if (!v) return;
    setState("loading");
    const src = channel.url;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (channel.isHls && Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, d) => d.fatal && setState("error"));
    } else {
      v.src = src;
      v.play().catch(() => {});
    }
  };

  return (
    <View style={styles.stage}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <video
        ref={videoRef}
        playsInline
        muted={muted}
        controls={false}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
          objectFit: "contain",
        }}
        onPlaying={() => setState("playing")}
        onPause={() => setState("paused")}
        onWaiting={() => setState("loading")}
        onError={() => {
          setState("error");
          setMessage(
            "Stream unavailable — public IPTV links go offline often.",
          );
        }}
      />

      {state === "loading" && (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.hint}>Tuning in to {channel.name}…</Text>
        </View>
      )}

      {state === "error" && (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.errorTitle}>Stream not available</Text>
          <Text style={styles.hint}>{message || "Try another channel."}</Text>
          <Pressable onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* control bar */}
      <View style={styles.controls} pointerEvents="box-none">
        <Pressable onPress={toggle} style={styles.ctrlBtn}>
          <Ionicons
            name={state === "playing" ? "pause" : "play"}
            size={18}
            color="#fff"
          />
        </Pressable>
        <Pressable
          onPress={() => {
            const v = videoRef.current;
            if (!v) return;
            v.muted = !muted;
            setMuted(!muted);
          }}
          style={styles.ctrlBtn}
        >
          <Ionicons
            name={muted ? "volume-mute" : "volume-high"}
            size={18}
            color="#fff"
          />
        </Pressable>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => videoRef.current?.requestFullscreen?.()}
          style={styles.ctrlBtn}
        >
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
      </View>
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
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
  errorTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  retry: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  retryText: { color: "#12141F", fontWeight: "800", fontSize: 12.5 },
  controls: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctrlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,11,18,0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,59,92,0.18)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveText: {
    color: colors.live,
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
