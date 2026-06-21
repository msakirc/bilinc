// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @smithy/* packages select native/browser submodule builds via export CONDITIONS.
// Without these, they load the node variants that export a `Symbol("node-only")`
// guard where a function is expected -> "Symbol(node-only) is not a function" at
// runtime. (@aws-sdk client packages have no exports field and are handled by the
// runtimeConfig redirect below.)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

const emptyShim = path.resolve(__dirname, 'src/shims/empty.js');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. AWS SDK v3 / @smithy packages resolve to their CJS build (package "main"),
  //    whose `./runtimeConfig` is the NODE variant (node-http-handler, node crypto).
  //    On RN that crashes with "TypeError: Symbol(node-only) is not a function".
  //    The browser/react-native package.json fields only remap the *dist-es* path,
  //    which Metro never loads, so force the `.native` runtimeConfig sibling here.
  if (
    /(^|\/)runtimeConfig$/.test(moduleName) &&
    /[\\/](@aws-sdk|@smithy)[\\/]/.test(context.originModulePath || '')
  ) {
    return context.resolveRequest(context, moduleName + '.native', platform);
  }

  // 2. Any straggler `node:`-prefixed builtin -> empty stub so the bundler resolves.
  //    The `.native` runtimeConfigs use fetch/web-crypto, so these are dead code.
  if (moduleName.startsWith('node:')) {
    return { type: 'sourceFile', filePath: emptyShim };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
