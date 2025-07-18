/* eslint-disable import/newline-after-import */
import '@fontsource-variable/raleway'
import publicLogo from '/vite-logo-public.svg'
import app from './app.vue'
// import logo from './assets/vite-logo.svg'
import './main.css'

// eslint-disable-next-line no-console
import('./async').then(console.log.bind(null, 'async'))

// eslint-disable-next-line no-console
console.log(new URL('./assets/vite-logo.svg', import.meta.url))

export {
  app,
  publicLogo,
  // logo,
}
