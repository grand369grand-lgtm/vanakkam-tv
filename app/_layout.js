/**
 * Root layout — a Stack with two kinds of screens:
 *   (tabs)  → the tab bar (Live / Search / Favourites / Settings)
 *   watch   → the full-screen player, pushed on top of the tabs
 *
 * Using a Stack here (instead of hiding 'watch' inside <Tabs>) is what lets
 * router.push('/watch') work from any screen.
 */
import React from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "@/store/AppContext";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="watch" />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
