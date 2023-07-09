import path from 'node:path'
import type { Plugin } from 'vite'
import { interpolateName } from 'loader-utils'
import { checkFormats, getAssetContent } from './utils'
import { DEFAULT_EXTENSIONS } from './constants'

type LoaderContext = Parameters<typeof interpolateName>[0]

type FuncName = (resourcePath: string, resourceQuery: string) => string
type FuncOutputPath = (
  url: string,
  resourcePath: string,
  resourceQuery: string
) => string

export interface Options {
  name?: string | FuncName
  limit?: number
  extensions?: string[]
  outputPath?: string | FuncOutputPath
  regExp?: RegExp
  publicUrl?: string
}

export default function VitePluginLibAssets(options: Options = {}): Plugin {
  const {
    name = '[contenthash].[ext]',
    limit,
    outputPath,
    regExp,
    extensions = DEFAULT_EXTENSIONS,
    publicUrl = '',
  } = options
  let isLibBuild = false
  let assetsDir: string
  let outDir: string
  let isIntermidiateFormat = false

  const assetsPathMap = new Map<string, string>()

  return {
    name: 'vite-plugin-lib-assets',
    apply: 'build',
    enforce: 'pre',
    configResolved({ build }) {
      isLibBuild = build.lib !== false
      assetsDir = build.assetsDir
      outDir = build.outDir
      if (build.lib !== false) {
        const { formats = ['es', 'umd'] } = build.lib
        const result = checkFormats(formats)
        if (!result.valid) {
          throw new Error(
            `[vite-plugin-lib-assets]: Configuration error. The plugin requires the "build.lib.formats" option to be either Array<'es' | 'cjs'> or Array<'umd' | 'iife'>, provided is ${formats}`,
          )
        }
        isIntermidiateFormat = result.isIntermidiateFormat
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
      const [pureId, resourceQuery] = id.split('?')
      const ext = path.extname(pureId)
      if (ext && extensions.includes(ext)) {
        const content = getAssetContent(id)

        if (!content)
          return null

        if (limit && content.byteLength < limit)
          return null

        const context = {
          resourcePath: pureId,
          resourceQuery,
        } as LoaderContext
        // @ts-expect-error loader-utils
        const url = interpolateName(context, name, { content, regExp })

        let assetPath = url
        const outputDir = outputPath || assetsDir
        assetPath = typeof outputDir === 'function'
          ? outputDir(url, pureId, resourceQuery)
          : path.join(outputDir, url)

        const filename = assetPath.replace(`?${resourceQuery}`, '')
        const fullname = path.join(process.cwd(), outDir, assetPath)

        this.emitFile({
          fileName: filename,
          name: fullname,
          source: content,
          type: 'asset',
        })

        // Cache the resource address for the "load" hook
        if (!isIntermidiateFormat) {
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
  }
}
