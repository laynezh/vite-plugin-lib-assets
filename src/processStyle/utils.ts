import { cssImageSetRE, cssUrlRE } from '../constants'
import { getCaptured } from '../utils'

export function getAssetsInStyle(source: string): string[] {
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

  return concernedAssets
}
