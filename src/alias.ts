import { type Alias } from 'vite'
import { type PluginContext } from 'rollup'

function matches(pattern: string | RegExp, importee: string): boolean {
  if (pattern instanceof RegExp)
    return pattern.test(importee)

  if (importee.length < pattern.length)
    return false

  if (importee === pattern)
    return true

  return importee.startsWith(`${pattern}/`)
}

export async function resolve(
  context: PluginContext,
  alias: Alias[],
  importees: string[],
  importer: string,
): Promise<string[]> {
  const resolves = importees.map((importee) => {
    const matched = alias.find(alias => matches(alias.find, importee))

    const updated = matched
      ? importee.replace(matched.find, matched.replacement)
      : importee

    return context
      .resolve(updated, importer, { skipSelf: true })
      .then(resolved => (resolved !== null ? resolved.id : updated))
  })

  return Promise.all(resolves)
}
