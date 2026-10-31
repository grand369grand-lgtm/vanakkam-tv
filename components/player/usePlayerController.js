/**
 * usePlayerController — the shared playback state machine.
 * ---------------------------------------------------------
 * Used by BOTH components/Player.js (native WebView) and
 * components/Player.web.js (browser Video.js). Pure React, no RN imports,
 * so it can be unit-tested in Node.
 *
 * Responsibilities:
 *  - own the ordered attempt list (primary + same-channel mirrors)
 *  - advance to the next *authorized, non-blocked* source when playback fails
 *  - remember permanently-failed urls for the session (no repeat hammering)
 *  - expose phase/status for the UI and a manual retry that clears memory
 *
 * It never claims to fix 403/401 — those are honest provider access rules.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FALLBACK_CONFIG,
  PLAYER_COMMANDS,
  PLAYER_EVENTS,
  buildAttempts,
  createFailureMemory,
  sanitizeHeaders,
  streamType,
} from "./bridge";
import { categorizeError } from "./error-handler";

/** Module-level session failure memory (survives across channels). */
const failureMemory = createFailureMemory();

export default function usePlayerController({ channel, alternates = [], sendCommand }) {
  const attemptsAll = useMemo(
    () => buildAttempts(channel, alternates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel?.id, channel?.url, alternates.length],
  );

  // Skip sources that already failed permanently this session.
  const attempts = useMemo(
    () => attemptsAll.filter((a, i) => i === 0 || !failureMemory.isBlocked(a.url)),
    [attemptsAll],
  );

  const [attemptIdx, setAttemptIdx] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading|buffering|playing|paused|error
  const [statusNote, setStatusNote] = useState("");
  const [finalError, setFinalError] = useState(null); // {category, friendly}
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const advancingRef = useRef(false);
  const watchdogRef = useRef(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    },
    [],
  );

  // Reset when the channel changes.
  useEffect(() => {
    setAttemptIdx(0);
    setPhase("loading");
    setFinalError(null);
    setStatusNote("");
    advancingRef.current = false;
  }, [channel?.id, attempts.length]);

  const current = attempts[Math.min(attemptIdx, attempts.length - 1)] || channel;

  /** Push the current attempt into the player (page/browser wrapper). */
  const loadCurrent = useCallback(
    (requestId) => {
      if (!current?.url || !sendCommand) return;
      sendCommand(PLAYER_COMMANDS.SET_SOURCE, {
        url: current.url,
        type: streamType(current.url),
        headers: sanitizeHeaders({
          // Custom (non-forbidden) headers only; UA/Referer are browser
          // forbidden and are deliberately not sent.
          ...(current.userAgent ? { "User-Agent": current.userAgent } : {}),
          ...(current.referrer ? { Referer: current.referrer } : {}),
        }),
        requestId,
        timeoutMs: FALLBACK_CONFIG.PER_ATTEMPT_TIMEOUT_MS,
      });
    },
    [current?.url, current?.userAgent, current?.referrer, sendCommand],
  );

  /** Ask the platform player to load attempt #idx. */
  const playAttempt = useCallback(
    (idx) => {
      const req = ++requestIdRef.current;
      setAttemptIdx(idx);
      setPhase("loading");
      setFinalError(null);
      setStatusNote("");
      advancingRef.current = false;
      // Load after state commit so handlers see the new attempt.
      setTimeout(() => {
        if (!mountedRef.current) return;
        loadCurrent(req);
        // Controller-side watchdog: guarantees the fallback chain advances
        // even when a source connects but never starts playing.
        clearWatchdog();
        watchdogRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          failureMemory.remember(attempts[idx]?.url, "NETWORK");
          if (idx + 1 < attempts.length) {
            setStatusNote("network timeout — trying next source");
            playAttempt(idx + 1);
          } else {
            setPhase("error");
            setFinalError({
              category: "NETWORK",
              friendly: "The stream server did not respond in time. It may be offline, slow, or geo-blocked by the provider.",
            });
          }
        }, FALLBACK_CONFIG.PER_ATTEMPT_TIMEOUT_MS + 1500);
      }, 0);
    },
    [loadCurrent, attempts.length, attempts, clearWatchdog],
  );

  const advance = useCallback(
    (failedUrl, errorInfo) => {
      failureMemory.remember(failedUrl, errorInfo?.category);
      if (advancingRef.current) return;
      advancingRef.current = true;
      const next = attemptIdx + 1;
      if (next < attempts.length) {
        setStatusNote(
          `${errorInfo ? categoryChip(errorInfo.category) + " — " : ""}trying source ${next + 1} of ${attempts.length}`,
        );
        setTimeout(() => mountedRef.current && playAttempt(next), 600);
      } else {
        setPhase("error");
        setFinalError(errorInfo || { category: "UNKNOWN", friendly: "Stream unavailable" });
      }
    },
    [attemptIdx, attempts.length, playAttempt],
  );

  /** Events coming from the platform player (WebView page / web wrapper). */
  const onEvent = useCallback(
    (event) => {
      if (!event || !mountedRef.current) return;
      const { type, payload = {} } = event;
      const isStale =
        typeof payload.requestId === "number" &&
        payload.requestId < requestIdRef.current &&
        type === PLAYER_EVENTS.PLAYBACK_ERROR;
      if (isStale) return; // error from a superseded source

      switch (type) {
        case PLAYER_EVENTS.PLAYER_READY:
          // First source is loaded by the platform player on mount.
          if (payload.requestId === undefined) loadCurrent(++requestIdRef.current);
          break;
        case PLAYER_EVENTS.PLAYBACK_STARTED:
          clearWatchdog();
          setPhase("playing");
          setStatusNote("");
          break;
        case PLAYER_EVENTS.PLAYBACK_PAUSED:
          setPhase((p) => (p === "playing" ? "paused" : p));
          break;
        case PLAYER_EVENTS.BUFFERING:
          setPhase((p) =>
            payload.buffering ? (p === "playing" ? "buffering" : "loading") : "playing",
          );
          break;
        case PLAYER_EVENTS.SOURCE_CHANGED:
          setStatusNote("");
          break;
        case PLAYER_EVENTS.PLAYBACK_ERROR: {
          clearWatchdog();
          const info = categorizeError(payload);
          advance(payload.url || current?.url, info);
          break;
        }
        case PLAYER_EVENTS.RETRY_REQUESTED:
          retryManual();
          break;
        case PLAYER_EVENTS.PLAYER_DESTROYED:
        case PLAYER_EVENTS.FULLSCREEN_CHANGED:
        case PLAYER_EVENTS.LOG:
        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advance, current?.url, loadCurrent],
  );

  /** Manual retry: clear failure memory for this channel's urls, restart. */
  const retryManual = useCallback(() => {
    failureMemory.clear(attempts.map((a) => a.url));
    playAttempt(0);
  }, [attempts, playAttempt]);

  return {
    attempts,
    attemptIdx,
    current,
    phase,
    statusNote,
    finalError,
    onEvent,
    retryManual,
    sendCommand,
  };
}

function categoryChip(category) {
  const chips = {
    AUTH: "access denied",
    NOT_FOUND: "dead link",
    SERVER: "server error",
    MANIFEST: "bad manifest",
    SSL: "broken HTTPS",
    CORS: "browser blocked",
    UNSUPPORTED: "unsupported format",
    DECODE: "decode error",
    NETWORK: "network timeout",
    UNKNOWN: "playback error",
  };
  return chips[category] || "playback error";
}
