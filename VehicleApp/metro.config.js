const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Metro from crawling the legacy backup tree inside the app root.
config.resolver.blockList = [
  /.*\.legacy_misplaced[\\/].*/,
];

module.exports = config;
