import type * as _compiler from 'vue/compiler-sfc'

export interface DescriptorOptions {
  root: string
  compiler: {
    impl: typeof _compiler
    version: string
  }
}
