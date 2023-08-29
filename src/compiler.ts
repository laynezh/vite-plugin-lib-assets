import { createRequire } from 'node:module'
import type { DescriptorOptions } from './types'

// extend the descriptor so we can store the scopeId on it
declare module 'vue/compiler-sfc' {
  interface SFCDescriptor {
    id: string
  }
}

export function resolveCompiler(root: string): DescriptorOptions['compiler'] {
  // resolve from project root first, then fallback to peer dep (if any)
  const vueMeta = tryRequire('vue/package.json', root)
  const version = vueMeta ? vueMeta.version.split('.')[0] : ''
  const compiler = tryRequire('vue/compiler-sfc', root) || tryRequire('vue/compiler-sfc')

  if (!compiler) {
    throw new Error(
      'Failed to resolve vue/compiler-sfc.\n'
      + 'vite-plugin-vue-setup-name requires vue (>=2.7.0) '
      + 'to be present in the dependency tree.',
    )
  }

  return { impl: compiler, version }
}

const _require = createRequire(import.meta.url)

function tryRequire(id: string, from?: string) {
  try {
    return from
      ? _require(_require.resolve(id, { paths: [from] }))
      : _require(id)
  }
  catch (e) { }
}
