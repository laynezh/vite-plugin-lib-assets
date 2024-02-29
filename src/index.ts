import fs from 'node:fs'
import path from 'node:path'
import type { Buffer } from 'node:buffer'
import { type Alias, type Plugin, type ResolvedConfig, createFilter } from 'vite'
import { type EmittedFile, type PluginContext } from 'rollup'
import { interpolateName } from 'loader-utils'
import { checkFormats, getAssetContent, getCaptured, getFileBase64, replaceAll } from './utils'
import { ASSETS_IMPORTER_RE, CSS_LANGS_RE, DEFAULT_ASSETS_RE, cssImageSetRE, cssUrlRE } from './constants'
import { resolveCompiler } from './compiler'
import { getDescriptor } from './descriptorCache'
import { resolve } from './alias'
import type { DescriptorOptions } from './types'
import { processStyle } from './processStyle'

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
  const publicDir = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`
  let isLibBuild = false
  let assetsDir: string
  let outDir: string
  let alias: Alias[] = []
  let viteConfig: ResolvedConfig
  const descriptorOptions: DescriptorOptions = {
    compiler: null as any, // to be set in buildStart
    root: process.cwd(),
  }

  const filter = createFilter(include, exclude)
  const cssLangFilter = createFilter(CSS_LANGS_RE)
  const assetsImporterFilter = createFilter(ASSETS_IMPORTER_RE)
  let transformSkipped = true
  let emittedAssets: Map<string, EmittedFile>
  const assetCache = new WeakMap<ResolvedConfig, Map<string, EmittedFile>>()
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
    const fullname = path.join(path.isAbsolute(outDir) ? process.cwd() : '', outDir, assetPath)

    const cache = assetCache.get(viteConfig)!
    if (!cache.has(filename)) {
      const emitted: EmittedFile = {
        fileName: filename,
        name: fullname,
        source: content,
        type: 'asset',
      }
      context.emitFile(emitted)
      cache.set(filename, emitted)
    }

    return assetPath
  }

  const extractFromSource = async (
    context: PluginContext,
    id: string,
    content: string,
  ): Promise<string[]> => {
    let source = content
    try {
      source = await processStyle(id, content, viteConfig)
    }
    catch (err) {
      console.warn(`[vite-plugin-lib-assets]: failed to preprocessCSS ${err}`)
    }

    const cssUrlAssets = getCaptured(source, cssUrlRE)
    const cssImageSetAssets = getCaptured(source, cssImageSetRE)
    const assets = [...cssUrlAssets, ...cssImageSetAssets]
    const pureAssets = assets.map(asset =>
      asset.startsWith('\'') || asset.startsWith('"')
        ? asset.slice(1, -1)
        : asset,
    )

    // skip format in base64, XML or http.
    // Due to aliases, this is not possible to determined by the asset path is relative or absolute.
    const concernedAssets = pureAssets.filter(
      asset => !asset.startsWith('data:') && !/^(?:https?:)?\/\//.test(asset),
    )

    return resolve(context, alias, Array.from(new Set(concernedAssets)), id)
  }

  const extractFromFile = async (context: PluginContext, id: string): Promise<string[]> => {
    const content = getAssetContent(id)
    if (!content)
      return []

    const [pureId] = id.split('?', 2)

    if (path.extname(pureId) === '.vue') {
      if (!descriptorOptions.compiler)
        descriptorOptions.compiler = resolveCompiler(descriptorOptions.root)

      const descriptor = getDescriptor(pureId, descriptorOptions)
      if (descriptor === undefined)
        return []

      const extractedAssetList = await Promise.all(
        descriptor.styles.map(style =>
          extractFromSource(context, id, style.content),
        ),
      )

      return extractedAssetList.flatMap(extractedAssets => extractedAssets)
    }

    return extractFromSource(context, id, content.toString())
  }

  // replace base64 back to assets path
  const processAssetsInStyle = (
    bundleSourceMap: Record<string, string>,
  ): Record<string, string> => {
    const updatedSourceMap = { ...bundleSourceMap }
    Object.keys(updatedSourceMap)
      .filter(name => path.extname(name) === '.css')
      .forEach((name) => {
        let updated = updatedSourceMap[name]
        base64AssetsPathMap.forEach((asset, base64) => {
          updated = replaceAll(updated, base64, publicUrl ? asset : `./${asset}`)
        })

        if (updatedSourceMap[name] !== updated)
          updatedSourceMap[name] = updated
      })

    return updatedSourceMap
  }

  // Modify the extracted resource address based on the output path of the importer
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
          const relativePath = path.posix.relative(fileDir, asset)
          const relativeAsset = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
          const originalAsset = `./${asset}`
          if (asset !== relativeAsset && updated.includes(originalAsset)) {
            /**
             * The use of single quotes, double quotes, and parentheses here is to prevent the disruption
             * of resource A when replacing resource B, whose address is a subset of the resource A's address.
             * For example, the ../fonts/FiraCode-Regular.woff2 and ../fonts/FiraCode-Regular.woff in the issue#58.
             * @see https://github.com/laynezh/vite-plugin-lib-assets/issues/58
             */
            updated = replaceAll(updated, `'${originalAsset}'`, `'${relativeAsset}'`)
            updated = replaceAll(updated, `"${originalAsset}"`, `"${relativeAsset}"`)
            updated = replaceAll(updated, `(${originalAsset})`, `(${relativeAsset})`)
          }
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
    buildEnd() {
      /**
       * Under watch mode:
       * 1. Reset the cache of emitted files
       * 2. Re-emit the files cached when re-build is triggered but the file remains unchanged
       *    In this situation, Vite won't resolve assets and this plugin wont't emit them,
       *    so they won't appear in the final output. We must trigger their emit manually.
       */
      if (transformSkipped)
        emittedAssets.forEach(emitted => this.emitFile(emitted))
      else
        emittedAssets = assetCache.get(viteConfig) ?? new Map()
      assetCache.set(viteConfig, new Map())
    },
    watchChange() {
      transformSkipped = true
    },
    transform() {
      transformSkipped = false
    },
    configResolved(config) {
      viteConfig = config
      assetCache.set(config, new Map())
      const { build, resolve } = config
      isLibBuild = build.lib !== false
      assetsDir = build.assetsDir
      outDir = build.outDir
      alias = resolve.alias
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
        const assetsFromCss = await extractFromFile(this, id)

        const validAssets = assetsFromCss
          .map(aid => path.resolve(path.dirname(id), aid))
          .filter(id => filter(id))
          .map(id => ({ id, content: getAssetContent(id) }))
          .filter(({ content }) => limit && content ? content.byteLength > limit : true)

        validAssets.forEach(({ id, content }) => {
          let assetPath = emitFile(this, id, content!)
          const base64 = getFileBase64(id, content!)
          if (publicUrl)
            assetPath = `${publicDir}${assetPath}`
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
      if (assetPath)
        return `export default '${publicDir}${assetPath}'`
    },
    async writeBundle(_, outputBundle) {
      const outputDir = path.isAbsolute(outDir) ? outDir : path.posix.join(process.cwd(), outDir)
      const bundleSourceMap = Object.keys(outputBundle).reduce((map, name) => {
        const filePath = path.posix.join(outputDir, name)
        const source = fs.readFileSync(filePath, 'utf8')
        map[name] = source
        return map
      }, {} as Record<string, string>)

      const updatedSourceMap = processAssetsInStyle(bundleSourceMap)
      const processedSourceMap = processAssetsInImporters(updatedSourceMap)

      Object.keys(bundleSourceMap)
        .filter(name => bundleSourceMap[name] !== processedSourceMap[name])
        .forEach((name) => {
          const outputPath = path.posix.join(outputDir, name)
          const updated = processedSourceMap[name]
          fs.writeFileSync(outputPath, updated)

          // Write the updated source back for Vite's reporter to accurately output the file size
          const bundle = outputBundle[name]
          if (bundle.type === 'chunk')
            bundle.code = updated
          else if (name.endsWith('.css'))
            bundle.source = updated
        })
    },
  }
}
