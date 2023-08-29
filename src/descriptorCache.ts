import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import slash from 'slash'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { DescriptorOptions } from './types'

const cache = new Map<string, { mtime: number; descriptor: SFCDescriptor }>()

// compiler-sfc should be exported so it can be re-used
export interface SFCParseResult {
  descriptor: SFCDescriptor
  errors: Error[]
}

export function parseSFC(filename: string, source: string, { version, impl: compiler }: DescriptorOptions['compiler']): SFCParseResult {
  let result: SFCParseResult
  if (version === '2') {
    let descriptor: SFCDescriptor
    let errors: Error[] = []
    try {
      // @ts-expect-error vue3 has different signature
      descriptor = compiler.parse({ source, filename, sourceMap: false })
    }
    catch (e) {
      errors = [e as Error]
      // @ts-expect-error vue3 has different signature
      descriptor = compiler.parse({ source: '', filename })
    }
    result = { descriptor, errors }
  }
  else if (version === '3') {
    // ts-expect-error vue2 has different signature
    result = compiler.parse(source, { filename, sourceMap: false })
  }
  else {
    throw new Error('Unknown vue version')
  }

  return result
}

export function createDescriptor(
  filename: string,
  source: string,
  { root, compiler }: DescriptorOptions,
): SFCParseResult {
  const { descriptor, errors } = parseSFC(filename, source, compiler)
  // ensure the path is normalized in a way that is consistent inside
  // project (relative to root) and on different systems.
  const normalizedPath = slash(path.normalize(path.relative(root, filename)))
  descriptor.id = getHash(normalizedPath)
  const { mtimeMs } = fs.statSync(filename)

  cache.set(filename, { mtime: mtimeMs, descriptor })
  return { descriptor, errors }
}

export function getDescriptor(
  filename: string,
  options: DescriptorOptions,
  createIfNotFound = true,
): SFCDescriptor | undefined {
  const { mtimeMs } = fs.statSync(filename)
  const cachedDescriptor = cache.get(filename)
  if (cachedDescriptor && cachedDescriptor.mtime === mtimeMs)
    return cachedDescriptor.descriptor

  if (createIfNotFound) {
    const { descriptor, errors } = createDescriptor(
      filename,
      fs.readFileSync(filename, 'utf-8'),
      options,
    )
    if (errors.length)
      throw errors[0]

    return descriptor
  }
}

function getHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 8)
}
