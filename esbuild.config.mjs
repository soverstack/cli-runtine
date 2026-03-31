import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  format: 'cjs',
  minify: false,       // Keep readable for debugging
  sourcemap: true,
  // shebang is already in src/index.ts, esbuild preserves it
  // Resolve tsconfig path aliases (@/*, @commands/*, etc.)
  alias: {
    '@': './src',
    '@commands': './src/commands',
    '@validators': './src/validators',
    '@generators': './src/generators',
    '@secrets': './src/secrets',
    '@utils': './src/utils',
  },
  // Mark native/binary modules as external (not bundleable)
  external: [
    'ssh2',
    'cpu-features',
  ],
});

console.log('Bundle built: dist/index.js');
