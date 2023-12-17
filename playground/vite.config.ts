import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import libAssets from '../src/'

export default defineConfig({
  resolve: {
    alias: {
      '@': './src',
    },
  },
  css: {
    // transformer: 'lightningcss',
  },
  build: {
    lib: {
      name: 'main',
      entry: {
        main: './src/main.ts',
        // mainCss: './src/main.css',
      },
      fileName: 'main',
      formats: ['es'],
    },
    // sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['vue'],
    },
  },
  plugins: [
    vue(),
    Inspect(),
    libAssets({
      name: '[name].[contenthash:8].[ext]',
    }),
  ],
})
