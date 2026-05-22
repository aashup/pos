const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');
const exampleModules = path.join(__dirname, 'node_modules');

/**
 * Watch the package root so Metro picks up live edits to ../src. The package
 * has no node_modules of its own, so resolve EVERY bare import (react,
 * react-native, peer deps, @babel/runtime helpers, …) from the example's
 * node_modules — a single, consistent copy. Standard create-react-native-library
 * setup.
 */
const config = {
  projectRoot: __dirname,
  watchFolders: [root],
  resolver: {
    // fast-tflite loads models via require(...) — register the asset extension.
    assetExts: [...getDefaultConfig(__dirname).resolver.assetExts, 'tflite'],
    extraNodeModules: new Proxy(
      {},
      { get: (_target, name) => path.join(exampleModules, String(name)) },
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
