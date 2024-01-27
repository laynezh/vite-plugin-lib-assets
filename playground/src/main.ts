/* eslint-disable import/newline-after-import */
import app from './app.vue'
// import logo from './assets/vite-logo.svg'
import './styles/index.css'

import('./async').then(console.log.bind(null, 'async'))

export {
  app,
  // logo,
}
