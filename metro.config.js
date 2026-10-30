// Default Expo Metro config. Kept explicit so `npx expo start --web` works
// the same way on macOS, Windows and Linux.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
