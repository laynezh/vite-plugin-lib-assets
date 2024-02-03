import type { Options } from 'tsup'

export default <Options>{
  entryPoints: [
    'src/index.ts',
  ],
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
  shims: true,
  onSuccess: 'npm run build:fix',
  external: ['vite', 'rollup'],
}
