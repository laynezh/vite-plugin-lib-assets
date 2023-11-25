import type { ResolvedConfig } from 'vite'
import { isObject } from '../utils'

export async function ensureCssSourceMapConfig(config: ResolvedConfig): Promise<ResolvedConfig> {
  let css = config.css ?? {}
  let build = config.build ?? {}
  if ('transformer' in css && css.transformer === 'lightningcss') {
    console.warn(
      '[vite-plugin-lib-assets]: The processing of style files using lightningcss is not yet supported by this plugin due to insufficient information. This might lead to incorrect handling of assets referenced in the @import files. https://github.com/laynezh/vite-plugin-lib-assets/issues/34#issuecomment-1826250269',
    )
    // build-time sourcemap from v5.0.0
    if (config.build.sourcemap === false)
      build = { ...build, sourcemap: true }

    // build-time sourcemap from v4.4.0
    if (!css.devSourcemap)
      css = { ...css, devSourcemap: true }
  }
  else {
    const { postcss = {} } = css

    if (typeof postcss !== 'string') {
      css = {
        ...css,
        postcss: {
          ...postcss,
          map: isObject(postcss.map) ? { ...postcss.map, inline: true } : { inline: true },
        },
      }
    }
    else {
      css = {
        ...css,
        postcss: {
          map: { inline: true },
        },
      }
    }
  }

  return { ...config, css, build }
}
