import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Buffer } from 'node:buffer'
import { type Plugin, type ResolvedConfig, createFilter, preprocessCSS } from 'vite'
import { type PluginContext } from 'rollup'
import { interpolateName } from 'loader-utils'
import { checkFormats, getAssetContent, getCaptured, getFileBase64 } from './utils'
import { CSS_LANGS_RE, DEFAULT_ASSETS_RE, cssImageSetRE, cssUrlRE } from './constants'

type LoaderContext = Parameters<typeof interpolateName>[0]

type FuncName = (resourcePath: string, resourceQuery: string) => string
type FuncOutputPath = (
  url: string,
  resourcePath: string,
  resourceQuery: string
) => string

export interface Options {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]
  name?: string | FuncName
  limit?: number
  outputPath?: string | FuncOutputPath
  regExp?: RegExp
  publicUrl?: string
}

export default function VitePluginLibAssets(options: Options = {}): Plugin {
  const {
    include = DEFAULT_ASSETS_RE,
    exclude,
    name = '[contenthash].[ext]',
    limit,
    outputPath,
    regExp,
    publicUrl = '',
  } = options
  let isLibBuild = false
  let assetsDir: string
  let outDir: string
  let viteConfig: ResolvedConfig

  const filter = createFilter(include, exclude)
  const cssLangFilter = createFilter(CSS_LANGS_RE)
  const assetsPathMap = new Map<string, string>()
  const base64AssetsPathMap = new Map<string, string>()
  const emitFile = (context: PluginContext, id: string, content: Buffer): string => {
    const [pureId, resourceQuery] = id.split('?')
    const loaderContext = {
      resourcePath: pureId,
      resourceQuery,
    } as LoaderContext
    // @ts-expect-error loader-utils
    const url = interpolateName(loaderContext, name, { content, regExp })

    let assetPath = url
    const outputDir = outputPath || assetsDir
    assetPath = typeof outputDir === 'function'
      ? path.join(outputDir(url, pureId, resourceQuery), url)
      : path.join(outputDir, url)

    const filename = assetPath.replace(`?${resourceQuery}`, '')
    const fullname = path.join(process.cwd(), outDir, assetPath)

    context.emitFile({
      fileName: filename,
      name: fullname,
      source: content,
      type: 'asset',
    })

    return assetPath
  }

  const extractAssetsFromCss = async (id: string): Promise<string[]> => {
    const content = getAssetContent(id)
    if (!content)
      return []

    const result = await preprocessCSS(content.toString(), id, viteConfig)

    const source = result.code
    const cssUrlAssets = getCaptured(source, cssUrlRE)
    const cssImageSetAssets = getCaptured(source, cssImageSetRE)
    const assets = [...cssUrlAssets, ...cssImageSetAssets]

    const importerDir = id.endsWith('/') ? id : path.dirname(id)
    return Array.from(new Set(assets.map(asset => path.resolve(importerDir, asset))))
  }

  return {
    name: 'vite-plugin-lib-assets',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      viteConfig = config
      const { build } = config
      isLibBuild = build.lib !== false
      assetsDir = build.assetsDir
      outDir = build.outDir
      if (build.lib !== false) {
        const { formats = ['es', 'umd'] } = build.lib
        const valid = checkFormats(formats)
        if (!valid && publicUrl) {
          console.warn(
            '[vite-plugin-lib-assets] The publicUrl configuration will be applied to all output formats.',
          )
        }
      }
    },
    async resolveId(source, importer) {
      if (!isLibBuild)
        return null

      if (importer === undefined)
        return null

      const importerDir = importer.endsWith('/')
        ? importer
        : path.dirname(importer)
      // Full path of the imported file
      const id = path.resolve(importerDir, source)

      if (cssLangFilter(id)) {
        const assetsFromCss = await extractAssetsFromCss(id)
        const validAssets = assetsFromCss
          .filter(id => filter(id))
          .map(id => ({ id, content: getAssetContent(id) }))
          .filter(({ content }) => limit && content ? content.byteLength < limit : true)

        validAssets.forEach(({ id, content }) => {
          const assetPath = emitFile(this, id, content!)
          const base64 = getFileBase64(id, content!)
          base64AssetsPathMap.set(base64, assetPath)
        })
      }

      if (filter(id)) {
        const content = getAssetContent(id)

        if (!content)
          return null

        if (limit && content.byteLength < limit)
          return null

        const assetPath = emitFile(this, id, content)

        // Cache the resource address for the "load" hook
        if (publicUrl) {
          assetsPathMap.set(id, assetPath)
          return id
        }

        // External file with the configured path, eg. './assets/image.hash.png'
        return {
          id: `./${assetPath}`,
          external: 'relative',
        }
      }
    },
    load(id) {
      if (!isLibBuild)
        return null

      const assetPath = assetsPathMap.get(id)
      if (assetPath) {
        const publicDir = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`
        return `export default '${publicDir}${assetPath}'`
      }
    },
    async writeBundle(_, outputBundle) {
      const assets = base64AssetsPathMap.entries()
      Object.keys(outputBundle)
        .filter(name => path.extname(name) === '.css')
        .forEach(async (name) => {
          const bundle = outputBundle[name]
          const isBundleAsset = 'source' in bundle
          let source = isBundleAsset ? String(bundle.source) : bundle.code
          Array.from(assets).forEach(([base64, asset]) => {
            source = source.replaceAll(base64, `./${asset}`)
          })

          const outputPath = path.join(process.cwd(), outDir, name)
          await promisify(fs.writeFile)(outputPath, source)
        })
    },
  }
}
