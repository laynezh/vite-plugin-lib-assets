import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { Buffer } from 'node:buffer'
import { preprocessCSS } from 'vite'
import type { PreprocessCSSResult, ResolvedConfig } from 'vite'
import type { ExistingRawSourceMap } from 'rollup'
import escapeStringRegexp from 'escape-string-regexp'
import { ensureCssSourceMapConfig } from './config'
import { getAssetsInStyle } from './utils'

const postcssSourceMapReg = /\/\*# sourceMappingURL=data:application\/json;base64,([^*]+)\*\//mi
function getSourceMapFromResult(
  result: PreprocessCSSResult,
  config: ResolvedConfig,
): ExistingRawSourceMap | null {
  const css = config.css ?? {}
  if ('transformer' in css && css.transformer === 'lightningcss') {
    if (typeof result.map === 'string') {
      try {
        return JSON.parse(result.map)
      }
      catch (err) {
        return null
      }
    }

    return (result.map && 'version' in result.map) ? result.map : null
  }
  else {
    const [_, sourceMapBase64] = result.code.match(postcssSourceMapReg) || ['', '']
    try {
      const sourceMap = Buffer.from(sourceMapBase64.trim(), 'base64').toString('utf8')
      return JSON.parse(sourceMap)
    }
    catch (err) {
      return null
    }
  }
}

async function rebaseStyleUrls(
  moduleId: string,
  result: PreprocessCSSResult,
  config: ResolvedConfig,
): Promise<PreprocessCSSResult> {
  const sourceMap = getSourceMapFromResult(result, config)
  if (sourceMap === null) {
    console.warn(
      '[vite-plugin-lib-assets]: Failed to obtain the sourcemap when handling the style file. This might lead to incorrect handling of assets referenced in the @import files. https://github.com/laynezh/vite-plugin-lib-assets/issues/34#issuecomment-1826250269',
    )
    return result
  }

  // no imported style files
  if (sourceMap.sources.length < 2)
    return result

  const moduleDir = path.dirname(moduleId)
  const { sources, sourcesContent = [] } = sourceMap

  const replacements = await Promise.all(
    sources.map(async (source, index) => {
      const escaped = escapeStringRegexp(source)
      const testRegExp = new RegExp(`${escaped}$`)

      if (testRegExp.test(moduleId))
        return []

      // sources of lightningcss lack leading slash
      if (source.indexOf(config.root.slice(1)) === 0)
        source = `/${source}`

      const filepath = path.isAbsolute(source) ? source : path.resolve(moduleDir, source)
      const fileDir = path.dirname(filepath)

      let content = sourcesContent[index]
      if (content === null) {
        if (fs.existsSync(filepath)) {
          content = await util.promisify(fs.readFile)(filepath, 'utf8')
        }
        else {
          console.warn(
            '[vite-plugin-lib-assets]: Failed to obtain the file content when handling the style file. This might lead to incorrect handling of assets referenced in the @import files. https://github.com/laynezh/vite-plugin-lib-assets/issues/34#issuecomment-1826250269',
          )
          return []
        }
      }

      const assets = getAssetsInStyle(content)
      return assets.map((asset) => {
        const assetPath = path.resolve(fileDir, asset)
        const replacement = path.relative(moduleDir, assetPath)
        return { [asset]: replacement }
      })
    }),
  )

  let source = result.code
  let position = 0
  replacements.flat().forEach((replacement) => {
    Object.keys(replacement).forEach((asset) => {
      const processed = source.slice(0, position)
      const left = source.slice(position)
      const assetIndex = left.indexOf(asset, position)
      const replaceValue = replacement[asset]

      source = processed + left.replace(asset, replaceValue)
      position = assetIndex + (replaceValue.length - asset.length)
    })
  })

  return { ...result, code: source }
}

export async function processStyle(
  moduleId: string,
  code: string,
  config: ResolvedConfig,
): Promise<string> {
  const needRebaseUrls = code.includes('@import')
  const processConfig = needRebaseUrls ? (await ensureCssSourceMapConfig(config)) : config
  let result = await preprocessCSS(code, moduleId, processConfig)

  if (needRebaseUrls) {
    result = await rebaseStyleUrls(moduleId, result, config)
    result.code = result.code.replace(postcssSourceMapReg, '')
  }

  return result.code
}
