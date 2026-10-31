/**
 * Player (native: iOS / Android)
 * ------------------------------
 * Thin wrapper around expo-video's <VideoView> with what a live IPTV app needs:
 * loading state, retryable error state, autoplay, native controls
 * (fullscreen / PiP where the platform supports it).
 *
 * Playback resilience (why free IPTV links die):
 *   1. Many iptv-org servers have broken HTTPS (expired cert, bad cipher,
 *      TLS 1.0 only) -> ExoPlayer throws SSLHandshakeException.
 *   2. Many streams are plain HTTP (blocked on Android unless cleartext is
 *      allowed — enabled in app.json).
 *   3. Public links change or die daily.
 *
 * So the player never gives up on the first failure: it walks an ordered
 * attempt list — [original url, http twin of original, mirror 1, http twin of
 * mirror 1, ...] — and only shows a hard error after every attempt failed.
 * The inner component is keyed on the attempt url, so switching attempts
 * always builds a fresh native player instead of reusing a broken one.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "@/theme";

const PER_ATTEMPT_TIMEOUT_MS = 12000; // live HLS should respond much faster than this
const MAX_ATTEMPTS = 5;

/** Translate low-level ExoPlayer errors into something a human can act on. */
export function friendlyError(msg = "") {
  const m = String(msg);
  if (/ssl|handshake|certificate|trust anchor|protocol error/i.test(m))
    return "The stream server's HTTPS certificate is broken — this is a problem with the stream, not your device.";
  if (/cleartext/i.test(m))
    return "This stream is plain HTTP and was blocked by the system.";
  if (/unable to connect|unknownhost|econnrefused|timed?\s?out|timeout/i.test(m))
    return "The stream server did not respond — it may be offline or geo-blocked.";
  if (/403|401|forbidden|unauthorized/i.test(m))
    return "The server refused the player (403) — the stream needs special access.";
  if (/404|not found|filenotfound/i.test(m))
    return "This stream link is dead (404) — links change daily.";
  if (/invalid|malformed|parse/i.test(m))
    return "The stream returned data we couldn't decode.";
  return m;
}

/**
 * Build the ordered attempt list for a channel.
 * Alternates are other entries of the same channel (same tvg-id / name) found
 * across the loaded playlists — different servers hosting the same channel.
 */
export function buildAttempts(channel, alternates = []) {
  const httpTwin = (url) =>
    /^https:\/\//i.test(url) ? url.replace(/^https:\/\//i, "http://") : null;

  const candidates = [channel];
  for (const alt of alternates) {
    if (candidates.length >= MAX_ATTEMPTS) break;
    if (alt?.url && alt.url !== channel.url) candidates.push(alt);
  }

  const out = [];
  const seen = new Set();
  for (const c of candidates) {
    // Original first…
    if (!seen.has(c.url)) {
      out.push(c);
      seen.add(c.url);
    }
    // …then its plain-HTTP twin (fixes broken-SSL servers that also serve :80).
    const twin = httpTwin(c.url);
    if (twin && !seen.has(twin) && out.length < MAX_ATTEMPTS) {
      out.push({ ...c, url: twin, viaCleartext: true });
      seen.add(twin);
    }
  }
  return out.slice(0, MAX_ATTEMPTS);
}

function PlayerInner({ channel, attemptLabel, onFatal }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [message, setMessage] = useState("");
  const reported = useRef(false);

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
    reported.current = false;
    const fail = (msg) => {
      if (reported.current) return;
      reported.current = true;
      setStatus("error");
      setMessage(msg);
      onFatal?.(msg);
    };

    const subs = [
      player.addListener("statusChange", (e) => {
        if (e.status === "readyToPlay") setStatus("ready");
        if (e.status === "error") fail(e.error?.message || "Stream unavailable");
      }),
    ];

    // Live HLS often buffers for a while before it reports ready — give up
    // per attempt so the next one (mirror / cleartext twin) gets its shot.
    const watchdog = setTimeout(() => {
      setStatus((s) => {
        if (s !== "loading") return s;
        fail(`No response after ${PER_ATTEMPT_TIMEOUT_MS / 1000}s`);
        return "error";
      });
    }, PER_ATTEMPT_TIMEOUT_MS);

    return () => {
      clearTimeout(watchdog);
      subs.forEach((s) => s?.remove?.());
    };
  }, [player, onFatal]);

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
          {attemptLabel ? <Text style={styles.attempt}>{attemptLabel}</Text> : null}
        </View>
      )}

      {status === "error" && (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.hint}>{friendlyError(message)}</Text>
        </View>
      )}
    </View>
  );
}

export default function Player({ channel, alternates = [], onError }) {
  const attempts = useMemo(
    () => buildAttempts(channel, alternates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel.id, channel.url, alternates.length],
  );

  const [attempt, setAttempt] = useState(0);
  const attemptRef = useRef(0);
  const [finalError, setFinalError] = useState("");

  // Reset the whole chain when the channel changes (outer key already forces
  // remount, but keep this as a safety net).
  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    setFinalError("");
  }, [channel.id]);

  const handleFatal = useCallback(
    (msg) => {
      onError?.(msg);
      const idx = attemptRef.current;
      if (idx + 1 < attempts.length) {
        // Brief pause so the user can see what happened before we switch.
        setTimeout(() => {
          attemptRef.current = idx + 1;
          setAttempt(idx + 1);
        }, 900);
      } else {
        setFinalError(msg || "Stream unavailable");
      }
    },
    [attempts.length, onError],
  );

  const retryAll = useCallback(() => {
    attemptRef.current = 0;
    setFinalError("");
    setAttempt(0);
  }, []);

  if (finalError) {
    return (
      <View style={styles.stage}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Stream not available</Text>
          <Text style={styles.hint}>
            {friendlyError(finalError)}
            {"\n"}Tried {attempts.length} source{attempts.length > 1 ? "s" : ""} —
            this public link may be offline or geo-blocked. Try another channel;
            links change daily.
          </Text>
          <Pressable onPress={retryAll} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const current = attempts[attempt] || channel;
  const label =
    attempt === 0
      ? ""
      : current.viaCleartext
        ? `Retrying without HTTPS (${attempt + 1}/${attempts.length})`
        : `Trying mirror ${attempt}/${attempts.length - 1}`;

  return (
    <PlayerInner
      key={current.url}
      channel={current}
      attemptLabel={label}
      onFatal={handleFatal}
    />
  );
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
  attempt: {
    color: colors.textFaint || colors.textMuted,
    fontSize: 11,
    opacity: 0.8,
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
