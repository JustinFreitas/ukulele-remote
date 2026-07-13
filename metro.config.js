const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

const pfxPath = path.resolve(__dirname, 'ukulele-keystore.p12');

if (fs.existsSync(pfxPath)) {
  config.server = {
    ...config.server,
    https: {
      pfx: fs.readFileSync(pfxPath),
      passphrase: '91b7ad4a34b4f70ffc542aa20474fcc0196dfbf8ec62436a'
    }
  };
}

module.exports = config;
