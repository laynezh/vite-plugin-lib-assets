// ** READ THIS ** before editing `KNOWN_ASSET_TYPES`.
//   If you add an asset to `KNOWN_ASSET_TYPES`, make sure to also add it
//   to the TypeScript declaration file `packages/vite/client.d.ts` and
//   add a mime type to the `registerCustomMime` in
//   `packages/vite/src/node/plugin/assets.ts` if mime type cannot be
//   looked up by mrmime.
export const KNOWN_ASSET_TYPES = [
  // images
  'apng',
  'png',
  'jpe?g',
  'jfif',
  'pjpeg',
  'pjp',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',

  // media
  'mp4',
  'webm',
  'ogg',
  'mp3',
  'wav',
  'flac',
  'aac',
  'opus',

  // fonts
  'woff2?',
  'eot',
  'ttf',
  'otf',

  // other
  'webmanifest',
  'pdf',
  'txt',
]

export const DEFAULT_ASSETS_RE = new RegExp(
  `\\.(${KNOWN_ASSET_TYPES.join('|')})(\\?.*)?$`,
)

export const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/

// https://drafts.csswg.org/css-syntax-3/#identifier-code-point
export const cssUrlRE = /(?<=^|[^\w\-\u0080-\uFFFF])url\((\s*('[^']+'|"[^"]+")\s*|[^'")]+)\)/

// Assuming a function name won't be longer than 256 chars
export const cssImageSetRE = /(?<=image-set\()((?:[\w\-]{1,256}\([^)]*\)|[^)])*)(?=\))/

export const ASSETS_IMPORTER_RE = /\.(css|js|cjs|mjs)(?:$|\?)/
