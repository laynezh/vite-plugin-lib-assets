import type { Buffer } from 'node:buffer'
import type * as _compiler from 'vue/compiler-sfc'

export interface DescriptorOptions {
  root: string
  compiler: {
    impl: typeof _compiler
    version: string
  }
}

type FuncOutputPath = (
  url: string,
  resourcePath: string,
  resourceQuery: string
) => string

export interface Options {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]
  name?: string
  limit?: number | ((filePath: string, content: Buffer) => boolean | undefined)
  outputPath?: string | FuncOutputPath
  regExp?: RegExp
  publicUrl?: string
}
