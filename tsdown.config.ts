import { defineConfig } from 'tsdown'

const pluginId = 'dsh-balance'
const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
]

export default defineConfig([
  {
    name: pluginId,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    clean: false,
    dts: false,
    sourcemap: true,
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    name: `${pluginId}/client`,
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    clean: false,
    dts: false,
    sourcemap: true,
    deps: {
      neverBundle: clientExternals,
      alwaysBundle: (id: string) => clientExternals.includes(id) ? false : true,
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
