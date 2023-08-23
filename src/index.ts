import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Buffer } from 'node:buffer'
import { type Plugin, type ResolvedConfig, createFilter, preprocessCSS } from 'vite'
import { type PluginContext } from 'rollup'
import { interpolateName } from 'loader-utils'
import { checkFormats, getAssetContent, getCaptured, getFileBase64 } from './utils'
import { ASSETS_IMPORTER_RE, CSS_LANGS_RE, DEFAULT_ASSETS_RE, cssImageSetRE, cssUrlRE, importCssRE } from './constants'

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
  const assetsImporterFilter = createFilter(ASSETS_IMPORTER_RE)
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
      ? path.posix.join(outputDir(url, pureId, resourceQuery), url)
      : path.posix.join(outputDir, url)

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

    let source = content.toString()
    if (importCssRE.test(source)) {
      const result = await preprocessCSS(source, id, viteConfig)
      source = result.code
    }

    const cssUrlAssets = getCaptured(source, cssUrlRE)
    const cssImageSetAssets = getCaptured(source, cssImageSetRE)
    const assets = [...cssUrlAssets, ...cssImageSetAssets]
    const pureAssets = assets.map(asset =>
      asset.startsWith('\'') || asset.startsWith('"')
        ? asset.slice(1, -1)
        : asset,
    )

    const importerDir = id.endsWith(path.sep) ? id : path.dirname(id)
    return Array.from(new Set(pureAssets.map(asset => path.resolve(importerDir, asset))))
  }

  // replace base64 back to assets path
  const processAssetsInStyle = (
    bundleSourceMap: Record<string, string>,
  ): Record<string, string> => {
    const updatedSourceMap = { ...bundleSourceMap }
    const assetsInStyle = base64AssetsPathMap.entries()
    Object.keys(updatedSourceMap)
      .filter(name => path.extname(name) === '.css')
      .forEach((name) => {
        let updated = updatedSourceMap[name]
        Array.from(assetsInStyle).forEach(([base64, asset]) => {
          updated = updated.replaceAll(base64, `./${asset}`)
        })

        if (updatedSourceMap[name] !== updated)
          updatedSourceMap[name] = updated
      })

    return updatedSourceMap
  }

  // Modify the extraced resource address based on the output path of the importer
  const processAssetsInImporters = (
    bundleSourceMap: Record<string, string>,
  ): Record<string, string> => {
    const updatedSourceMap = { ...bundleSourceMap }
    const assetsExtracted = Object.keys(updatedSourceMap).filter(id => filter(id))
    Object.keys(updatedSourceMap)
      .filter(name => assetsImporterFilter(name))
      .forEach((name) => {
        let updated = updatedSourceMap[name]

        const fileDir = path.dirname(name)
        assetsExtracted.forEach(async (asset) => {
          const relativeAsset = path.posix.relative(fileDir, asset)
          const originalAsset = `./${asset}`
          if (asset !== relativeAsset && updated.includes(originalAsset))
            updated = updated.replaceAll(originalAsset, relativeAsset)
        })

        if (updatedSourceMap[name] !== updated)
          updatedSourceMap[name] = updated
      })

    return updatedSourceMap
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
    async resolveId(source, importer = '') {
      if (!isLibBuild)
        return null

      const importerDir = importer.endsWith(path.sep)
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
      const bundleSourceMap = Object.keys(outputBundle).reduce((map, name) => {
        const bundle = outputBundle[name]
        const source = 'source' in bundle ? String(bundle.source) : bundle.code
        map[name] = source
        return map
      }, {} as Record<string, string>)

      const updatedSourceMap = processAssetsInStyle(bundleSourceMap)
      const processedSourceMap = processAssetsInImporters(updatedSourceMap)

      const outputDir = path.posix.join(process.cwd(), outDir)
      Object.keys(bundleSourceMap)
        .filter(name => bundleSourceMap[name] !== processedSourceMap[name])
        .forEach(async (name) => {
          const outputPath = path.posix.join(outputDir, name)
          await promisify(fs.writeFile)(outputPath, processedSourceMap[name])
        })
    },
  }
}
