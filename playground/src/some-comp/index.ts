import png from './assets/abc.png'

const pngInFolderUrl = new URL('./assets/abc.png', import.meta.url).href

export const staticAssets = [pngInFolderUrl, png]
