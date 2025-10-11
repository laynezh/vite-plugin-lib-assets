import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import libAssets, { DEFAULT_ASSETS_RE } from '../src/'

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
      // 使用 preserveModules 时不需要 fileName，会保持原始文件名
      // fileName: 'main',
      formats: ['es'],
    },
    sourcemap: true,
    cssCodeSplit: true,
    // sourcemap: true,
    minify: false,
    rollupOptions: {
      external: ['vue'],
      output: {
        preserveModules: true, // 启用 preserveModules 来测试
        preserveModulesRoot: 'src', // 指定模块根目录
      },
    },
  },
  plugins: [
    vue(),
    Inspect(),
    libAssets({
      include: [
        DEFAULT_ASSETS_RE,
        /\.json(\?.*)?$/,
      ],
      name: '[name].[contenthash:8].[ext]',
      // 启用 import 转 new URL 功能
      convertToNewUrl: true,
    }),
  ],
})
