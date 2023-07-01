import fs from 'node:fs'
import type { Buffer } from 'node:buffer'
import type { LibraryFormats } from 'vite'

type IntermidiateFormats = Array<'es' | 'cjs'>
type FinalFormats = Array<'umd' | 'iife'>

const intermidiateFormats: IntermidiateFormats = ['es', 'cjs']
const finalFormats: FinalFormats = ['umd', 'iife']

export function checkFormats(formats: LibraryFormats[]) {
  const isIntermidiateFormat = formats.some(format => intermidiateFormats.includes(format as IntermidiateFormats[number]))
  const isFinalFormat = formats.some(format => finalFormats.includes(format as FinalFormats[number]))

  return {
    isIntermidiateFormat,
    isFinalFormat,
    // isIntermidiateFormat、isFinalFormat 一个为 true 一个为 false
    valid: Number(isIntermidiateFormat) + Number(isFinalFormat) === 1,
  }
}

// 缓存重复引入的文件内容
const assetsContentMap = new Map<string, Buffer>()
export function getAssetContent(id: string) {
  let content: Buffer | undefined | null = assetsContentMap.get(id)
  const pureId = id.split('?')[0]
  if (!content) {
    if (!fs.existsSync(pureId)) {
      console.warn(`[vite-plugin-lib-assets]: file not found ${id}`)
      content = null
    }
    else {
      content = fs.readFileSync(pureId)
      assetsContentMap.set(id, content)
    }
  }

  return content
}
