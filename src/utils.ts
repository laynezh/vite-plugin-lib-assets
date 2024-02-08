import fs from 'node:fs'
import type { Buffer } from 'node:buffer'
import { type LibraryFormats, version } from 'vite'
import { gte } from 'semver'
import * as mrmime from 'mrmime'
import escapeStringRegexp from 'escape-string-regexp'
import { svgToDataURL } from './vitools'

export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

type IntermidiateFormats = Array<'es' | 'cjs'>
type FinalFormats = Array<'umd' | 'iife'>

const intermidiateFormats: IntermidiateFormats = ['es', 'cjs']
const finalFormats: FinalFormats = ['umd', 'iife']

export function checkFormats(formats: LibraryFormats[]) {
  const isIntermidiateFormat = formats.some(format => intermidiateFormats.includes(format as IntermidiateFormats[number]))
  const isFinalFormat = formats.some(format => finalFormats.includes(format as FinalFormats[number]))

  return Number(isIntermidiateFormat) + Number(isFinalFormat) === 1
}

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

const postfixRE = /[?#].*$/s
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function getFileBase64(id: string, content: Buffer): string {
  const file = cleanUrl(id)
  /**
   * Starting from version 5.0.0, Vite employs a new approach for converting SVG files into their base64 format.
   * @see https://github.com/vitejs/vite/pull/14643
   */
  if (gte(version, '5.0.0') && file.endsWith('.svg')) {
    return svgToDataURL(content)
  }
  else {
    const mimeType = mrmime.lookup(file) ?? 'application/octet-stream'
    // base64 inlined as a string
    return `data:${mimeType};base64,${content.toString('base64')}`
  }
}

export function getCaptured(input: string, re: RegExp): string[] {
  const captures = []
  let match: RegExpExecArray | null
  let remaining = input
  // eslint-disable-next-line no-cond-assign
  while (match = re.exec(remaining)) {
    match[1] !== undefined && captures.push(match[1])
    remaining = remaining.slice(match.index + match[0].length)
  }

  return captures
}

/**
 * A simplified version of `String.replaceAll` to address compatibility issues on Node 14
 */
export function replaceAll(source: string, searchValue: string, replaceValue: string): string {
  const escaped = escapeStringRegexp(searchValue)
  const replaceRegExp = new RegExp(escaped, 'g')
  return source.replace(replaceRegExp, replaceValue)
}
