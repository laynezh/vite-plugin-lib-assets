/* eslint-disable import/newline-after-import */
// import '@fontsource-variable/raleway'
import publicLogo from '/vite-logo-public.svg'
import app from './app.vue'
// import logo from './assets/vite-logo.svg'
import './main.css'
import test from './assets/test.json'

// BUG TEST: export * 会导致 some-comp/index.ts 的 new URL() 无法被处理
// Workaround: 使用显式导入而不是 export *
import { staticAssets } from './some-comp'
export { staticAssets }

// 如果必须使用 export *，new URL() 中的资源会被内联为 base64
// 建议：对于使用 new URL() 的模块，使用显式的 import/export
// export * from './some-comp'  // 这会导致 new URL() 资源被内联

// WORKAROUND: 使用显式 import (已测试，不需要了)
// import { staticAssets } from './some-comp'

// eslint-disable-next-line no-console
import('./async').then(console.log.bind(null, 'async'))

// Test new URL syntax with import.meta.url
// eslint-disable-next-line no-console
console.log('Single quotes:', new URL('./assets/vite-logo.svg', import.meta.url))

// 测试从 some-comp 导入的资产 (使用 export *)
// console.log('Static assets from some-comp:', staticAssets)

// eslint-disable-next-line no-console, @typescript-eslint/quotes
console.log('Double quotes:', new URL("./assets/vite-logo.svg", import.meta.url))

// Template literal without interpolation
// eslint-disable-next-line no-console, @typescript-eslint/quotes
console.log('Template literal:', new URL(`./assets/vite-logo.svg`, import.meta.url))

// Export the URL for external use
const iconUrl = new URL('./assets/vite-logo.svg', import.meta.url)
const pngUrl = new URL('./assets/chrome-file.png', import.meta.url)
const jsonUrl = new URL('./assets/test.json', import.meta.url)

export {
  app,
  publicLogo,
  test,
  iconUrl,
  pngUrl,
  jsonUrl,
  // logo,
}
