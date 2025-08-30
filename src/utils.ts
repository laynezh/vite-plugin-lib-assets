import fs from 'node:fs'
import path from 'node:path'
import type { Buffer } from 'node:buffer'
import { type LibraryFormats, type ResolvedConfig, version } from 'vite'
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

// add own dictionary entry by directly assigning mrmime
export function registerCustomMime(): void {
  // https://github.com/lukeed/mrmime/issues/3
  // instead of `image/vnd.microsoft.icon` which is registered on IANA Media Types DB
  // image/x-icon should be used instead for better compatibility (https://github.com/h5bp/html5-boilerplate/issues/219)
  // eslint-disable-next-line dot-notation
  mrmime.mimes['ico'] = 'image/x-icon'
  // https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
  // eslint-disable-next-line dot-notation
  mrmime.mimes['cur'] = 'image/x-icon'
  // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers#flac
  // eslint-disable-next-line dot-notation
  mrmime.mimes['flac'] = 'audio/flac'
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
  // eslint-disable-next-line dot-notation
  mrmime.mimes['eot'] = 'application/vnd.ms-fontobject'
  // https://github.com/lukeed/mrmime/issues/10
  // eslint-disable-next-line dot-notation
  mrmime.mimes['jxl'] = 'image/jxl'
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
  if (typeof source.replaceAll === 'function')
    return source.replaceAll(searchValue, replaceValue)
  const escaped = escapeStringRegexp(searchValue)
  const replaceRegExp = new RegExp(escaped, 'g')
  return source.replace(replaceRegExp, replaceValue)
}

const publicFileCache = new Map<string, boolean>()
/**
 * Check if the asset is under the public directory
 * @param source - The source file path
 * @param publicDir - The public directory path
 * @returns True if the asset is under the public directory, false otherwise
 */
export function checkPublicAsset(source: string, publicDir: ResolvedConfig['publicDir']): boolean {
  if (!source.startsWith('/') || !publicDir)
    return false
  const publicFile = path.posix.join(publicDir, source)

  if (publicFileCache.has(publicFile))
    return publicFileCache.get(publicFile)!

  const exists = fs.existsSync(publicFile)
  if (exists)
    publicFileCache.set(publicFile, exists)

  return exists
}

/**
 * Append a key-value pair to the URL query string
 * @param url - The URL to append the key-value pair to
 * @param kv - The key-value pair query, eg. 'url=true'
 * @returns The URL with the key-value pair appended
 */
export function appendUrlQuery(url: string, kv: string): string {
  console.log('appendUrlQuery', url, kv)
  return url.includes('?') ? `${url}&${kv}` : `${url}?${kv}`
}

/**
 * Remove a key-value pair from the URL query string
 * @param url - The URL to remove the key-value pair from
 * @param kv - The key-value pair query, eg. 'url=true'
 * @returns The URL without the key-value pair
 */
export function removeUrlQuery(url: string, kv: string): string {
  console.log('removeUrlQuery', url, kv)
  const [urlWithoutQuery, query = ''] = url.split('?')
  const queryParams = query.split('&')
  const filteredQueryParams = queryParams.filter(param => param !== kv)
  if (filteredQueryParams.length === 0)
    return urlWithoutQuery
  return `${urlWithoutQuery}?${filteredQueryParams.join('&')}`
}
