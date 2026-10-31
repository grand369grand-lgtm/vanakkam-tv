/**
 * VideoJsPlayer (web)
 * -------------------
 * Web gets a SEPARATE Video.js implementation (no WebView needed): Video.js 8
 * runs directly on a DOM <video> element, with VHS via MSE on Chrome/Firefox/
 * Edge and native HLS on Safari. It speaks the exact same bridge protocol as
 * the native WebView player, so components/Player.web.js shares the identical
 * fallback state machine.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { PLAYER_EVENTS, streamType } from "./player/bridge";

const VideoJsPlayer = forwardRef(function VideoJsPlayerWeb({ onEvent, style }, ref) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const currentRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let disposed = false;
    const ev = (type, payload) => {
      if (!disposed && onEventRef.current) onEventRef.current({ type, payload: payload || {} });
    };

    const player = videojs(videoRef.current, {
      controls: false,
      autoplay: true,
      muted: true, // browsers only autoplay muted; user unmutes via control bar
      preload: "auto",
      playsinline: true,
      liveui: true,
      fill: true,
      userActions: { hotkeys: false },
      html5: {
        vhs: {
          overrideNative: !(
            videojs.browser.IS_SAFARI ||
            videojs.browser.IS_ANY_SAFARI ||
            videojs.browser.IS_IOS
          ),
          withCredentials: false,
        },
      },
    });
    playerRef.current = player;

    player.on("loadstart", () => ev(PLAYER_EVENTS.BUFFERING, { buffering: true }));
    player.on("waiting", () => ev(PLAYER_EVENTS.BUFFERING, { buffering: true }));
    player.on("canplay", () => ev(PLAYER_EVENTS.BUFFERING, { buffering: false }));
    player.on("playing", () => ev(PLAYER_EVENTS.PLAYBACK_STARTED));
    player.on("pause", () => ev(PLAYER_EVENTS.PLAYBACK_PAUSED));
    player.on("error", () => {
      const err = player.error() || {};
      ev(PLAYER_EVENTS.PLAYBACK_ERROR, {
        code: err.code,
        message: String(err.message || "Playback failed"),
        platform: "web",
      });
    });
    ev(PLAYER_EVENTS.PLAYER_READY, { vjsVersion: videojs.VERSION || "" });

    return () => {
      disposed = true;
      try {
        player.dispose();
      } catch (e) {}
      playerRef.current = null;
      ev(PLAYER_EVENTS.PLAYER_DESTROYED, {});
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send: (type, payload = {}) => {
        const p = playerRef.current;
        if (!p) return;
        switch (type) {
          case "SET_SOURCE": {
            currentRef.current = payload;
            try {
              p.error(null);
              p.src({ src: payload.url, type: payload.type || streamType(payload.url) });
              const pr = p.play();
              if (pr && pr.catch) pr.catch(() => {});
              onEventRef.current?.({
                type: PLAYER_EVENTS.SOURCE_CHANGED,
                payload: { requestId: payload.requestId },
              });
            } catch (e) {
              onEventRef.current?.({
                type: PLAYER_EVENTS.PLAYBACK_ERROR,
                payload: { message: String(e), platform: "web", requestId: payload.requestId },
              });
            }
            break;
          }
          case "PLAY": {
            const pr = p.play();
            if (pr && pr.catch) pr.catch(() => {});
            break;
          }
          case "PAUSE":
            p.pause();
            break;
          case "RETRY": {
            const src = currentRef.current;
            if (src?.url) {
              try {
                p.error(null);
                p.src({ src: src.url, type: src.type || streamType(src.url) });
                const pr = p.play();
                if (pr && pr.catch) pr.catch(() => {});
              } catch (e) {}
            }
            break;
          }
          case "EXIT_FULLSCREEN":
            if (document.exitFullscreen) document.exitFullscreen();
            break;
          case "DESTROY":
            try {
              p.dispose();
            } catch (e) {}
            playerRef.current = null;
            break;
          default:
            break;
        }
      },
      destroy: () => {
        try {
          playerRef.current?.dispose();
        } catch (e) {}
        playerRef.current = null;
      },
    }),
    [],
  );

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#000", ...style }}>
      <div data-vjs-player style={{ width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="video-js vjs-fill"
          playsInline
          muted
          style={{ width: "100%", height: "100%", backgroundColor: "#000", objectFit: "contain" }}
        />
      </div>
    </div>
  );
});

export default VideoJsPlayer;
