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
            `Vite 配置异常，插件仅支持 build.lib.formats 类型为 Array<'es' | 'cjs'> | Array<'umd' | 'iife'>，当前传入的是 ${formats}`
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
      // 引入文件的完整路径
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

        // 非 es、cjs 格式构建，暂存资源地址供 load 使用
        if (!isIntermidiateFormat) {
          assetsPathMap.set(id, assetPath)
          return id
        }

        // es、cjs 格式构建 external 文件，转译成 require('./assets/image.hash.png')
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
