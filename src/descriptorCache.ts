import fs from 'node:fs'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { DescriptorOptions } from './types'

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

export function getDescriptor(
  filename: string,
  options: DescriptorOptions,
  createIfNotFound = true,
): SFCDescriptor | undefined {
  if (createIfNotFound) {
    const { compiler } = options
    const { descriptor, errors } = parseSFC(filename, fs.readFileSync(filename, 'utf-8'), compiler)
    if (errors.length)
      throw errors[0]

    return descriptor
  }
}
