const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

const pfxPath = path.resolve(__dirname, 'ukulele-keystore.p12');

if (fs.existsSync(pfxPath) && process.env.UKULELE_KEYSTORE_PASSPHRASE) {
  config.server = {
    ...config.server,
    https: {
      pfx: fs.readFileSync(pfxPath),
      passphrase: process.env.UKULELE_KEYSTORE_PASSPHRASE
    }
  };
}

module.exports = config;
