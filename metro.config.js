const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'react-dom') {
      return {
        filePath: path.resolve(__dirname, 'stubs/react-dom.js'),
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
