/**
 * VideoJsPlayer (native: iOS / Android)
 * --------------------------------------
 * The native video container: a React Native WebView hosting Video.js 8 with
 * VHS for HLS. One WebView instance plays every source — switching channels
 * or falling back to a mirror happens through the bridge (SET_SOURCE command)
 * without reloading the page, which keeps startup fast and avoids leaks.
 *
 * Bridge summary
 *   page -> RN : PLAYER_READY, PLAYBACK_STARTED, PLAYBACK_PAUSED, BUFFERING,
 *                PLAYBACK_ERROR, SOURCE_CHANGED, RETRY_REQUESTED,
 *                FULLSCREEN_CHANGED, PLAYER_DESTROYED  (postMessage, JSON)
 *   RN -> page : SET_SOURCE, PLAY, PAUSE, RETRY, EXIT_FULLSCREEN, DESTROY
 *                (injectJavaScript -> window.__vkReceive)
 *
 * The component never reloads the WebView for a new source; only a crashed
 * renderer (Android onRenderProcessGone / iOS onContentProcessDidTerminate)
 * triggers a reload.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildPlayerHtml } from "./player/playerTemplate";
import { PLAYER_EVENTS } from "./player/bridge";

const VideoJsPlayer = forwardRef(function VideoJsPlayer(
  { onEvent, style, debug = false },
  ref,
) {
  const webRef = useRef(null);
  const aliveRef = useRef(true);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const html = useMemo(() => buildPlayerHtml({ debug }), [debug]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Inject a command into the page as safe JS source. */
  const inject = useCallback((type, payload) => {
    const web = webRef.current;
    if (!web || !aliveRef.current) return;
    try {
      const inner = JSON.stringify({ type, payload: payload || {} });
      web.injectJavaScript(
        `window.__vkReceive && window.__vkReceive(${JSON.stringify(inner)}); true;`,
      );
    } catch (e) {
      // WebView may already be tearing down — ignore.
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send: (type, payload) => inject(type, payload),
      destroy: () => inject("DESTROY"),
    }),
    [inject],
  );

  const handleMessage = useCallback((e) => {
    let msg = null;
    try {
      msg = JSON.parse(e?.nativeEvent?.data);
    } catch (err) {
      return;
    }
    if (msg && msg.type && onEventRef.current) onEventRef.current(msg);
  }, []);

  /** Android: WebView renderer crashed — reload so the player re-initialises. */
  const handleRenderProcessGone = useCallback(() => {
    onEventRef.current?.({
      type: PLAYER_EVENTS.LOG,
      payload: { msg: "webview render process gone — reloading" },
    });
    try {
      webRef.current?.reload();
    } catch (e) {}
  }, []);

  /** iOS: WKWebView content terminated — same recovery. */
  const handleContentTerminated = useCallback(() => {
    try {
      webRef.current?.reload();
    } catch (e) {}
  }, []);

  return (
    <View style={[styles.fill, style]}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: "https://vanakkam.local" }}
        originWhitelist={["*"]}
        style={styles.fill}
        backgroundColor="#000000"
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        allowsPictureInPictureMediaPlayback
        allowsAirPlayForMediaPlayback
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        cacheEnabled={false}
        startInLoadingState={false}
        overScrollMode="never"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        onRenderProcessGone={handleRenderProcessGone}
        onContentProcessDidTerminate={handleContentTerminated}
        androidLayerType="hardware"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%", backgroundColor: "#000" },
});

export default VideoJsPlayer;
