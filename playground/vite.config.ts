import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import libAssets from '../src/'

export default defineConfig({
  build: {
    lib: {
      entry: './main.ts',
      fileName: 'main',
      formats: ['cjs'],
    },
    minify: false,
  },
  plugins: [
    Inspect(),
    libAssets({
      name: '[name].[contenthash:8].[ext]',
    }),
  ],
})
