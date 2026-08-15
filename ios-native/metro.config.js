const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Wired to resolve the shared Chopsticks engine/session/ai code from the
 * parent workspace so the native app uses a single engine implementation.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    resolveRequest: (context, moduleName, platform) => {
      const defaultResolver = context.resolveRequest;

      // Resolve from a given directory by pretending the request originated
      // there. This lets us prefer the iOS native shell's node_modules for
      // npm packages while keeping shared source files outside ios-native/.
      const tryResolveFrom = (dir, name) => {
        const fakeContext = { ...context, originModulePath: path.join(dir, 'index.js') };
        return defaultResolver(fakeContext, name, platform);
      };

      const tryResolveDefault = (name) => defaultResolver(context, name, platform);

      // 1. Package imports: prefer the RN shell's node_modules so the shared
      //    workspace's root node_modules (which may contain a different RN
      //    version used only for typechecking) never shadows the shell deps.
      if (!moduleName.startsWith('.') && !path.isAbsolute(moduleName)) {
        try {
          return tryResolveFrom(projectRoot, moduleName);
        } catch {
          // fall through to default resolution
        }
      }

      // 2. TypeScript `.js` extension imports: the shared engine/session/ai
      //    code uses Node16/Bundler style imports (e.g. `./applyMove.js`).
      //    Metro does not map `.js` to `.ts`/`.tsx`, so try those first.
      if (moduleName.endsWith('.js') && !moduleName.includes('node_modules')) {
        const base = moduleName.slice(0, -3);
        for (const ext of ['.ts', '.tsx', '.js']) {
          try {
            return tryResolveDefault(base + ext);
          } catch {
            // continue to next extension
          }
        }
      }

      return tryResolveDefault(moduleName);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
