English | [中文](https://github.com/laynezh/vite-plugin-lib-assets/blob/main/README.ZH-CN.md)

# @laynezh/vite-plugin-lib-assets

A Vite Plugin extracts resource files referenced in [`library mode`](https://vitejs.dev/guide/build.html#library-mode) instead of embedded them as base64.

## Install

```bash
npm i @laynezh/vite-plugin-lib-assets -D
```

Or

```bash
yarn add @laynezh/vite-plugin-lib-assets -D
```

Or

```bash
pnpm add @laynezh/vite-plugin-lib-assets -D
```

## Usage

```typescript
// vite.config.ts
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets'

export default defineConfig({
  plugins: [
    libAssetsPlugin({ /* options */ }),
  ],
})
```

Example: [`playground/`](./playground/)

### Hints

- If `build.ssr` is set to `true`, you might want to enable `build.ssrEmitAssets`, so assets are emitted.

## Option

```typescript
export interface Options {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]
  name?: string
  limit?: number
  outputPath?: string | ((url: string, resourcePath: string, resourceQuery: string) => string)
  regExp?: RegExp
  publicUrl?: string
  convertToNewUrl?: boolean
}
```

### `include`

A valid [picomatch](https://github.com/micromatch/picomatch#globbing-features) pattern, or array of patterns indicate which files need to be handled by the plugin.

- Type: `string | RegExp | (string | RegExp)[]`
- Default: Same as Vite's default value for [`assetsInclude`](https://vitejs.dev/config/shared-options.html#assetsinclude), you can find the complete list [here](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts#L91-L135).
- Example:
  ```typescript
  libAssetsPlugin({
    include: /\.a?png(\?.*)?$/
  })
  ```

### `exclude`

Same as `include`, but it is used to indicate the files that should to be omitted.

- Type: `string | RegExp | (string | RegExp)[]`
- Default: `undefined`.
- Example:
  ```typescript
  libAssetsPlugin({
    exclude: /\.svg(\?.*)?$/
  })
  ```

### `name`

Output name of the resource file, its usage aligns with the [`name`](https://github.com/webpack-contrib/file-loader#name) option of the `file-loader`.

- Type: `string`
- Default: `'[contenthash].[ext]'`
- Example:
  ```typescript
  libAssetsPlugin({
    name: '[name].[contenthash:8].[ext][query]'
  })
  ```
> The complete list can be found at [`loader-utils#interpolatename`](https://github.com/webpack/loader-utils#interpolatename)

### `limit`

Files larger than the `limit` will be extracted to the output directory, smaller files will remain embedded in the artifact in base64 format.

- Type: `number`，unit `Byte`
- Default: `undefined`，any size of resource files will be extracted
- Example:
  ```typescript
  libAssetsPlugin({
    limit: 1024 * 8 // 8KB
  })
  ```

### `outputPath`

Specify the output path where the extracted files will be placed.

- Type: `string | ((url: string, resourcePath: string, resourceQuery: string) => string)`
- Default: `Vite`'s [`assetsDir`](https://vitejs.dev/config/build-options.html#build-assetsdir) configuration.
- Example:
  - `string`
    ```typescript
    libAssetsPlugin({
      outputPath: 'images'
    })
    ```
  - `function`
    ```typescript
    libAssetsPlugin({
      outputPath: (url, resourcePath, resourceQuery) => {
        // `url` - file name processed by the `name` option，eg: `logo.fb2133.png`
        // `resourcePath` - `/original/absolute/path/to/file.js`
        // `resourceQuery` - `?foo=bar`

        return url.endsWith('.png') ? 'image' : 'assets'
      },
    })
    ```

### `regExp`

Specifies a Regular Expression to extract parts of content(capture groups) from the file path and use [N] as placeholders in the `name` for replacement. Its usage aligns with the [`regexp`](https://github.com/webpack-contrib/file-loader#regexp) option of the `file-loader`.

- Type: `RegExp`
- Default: `undefined`
- Example:
  ```typescript
  libAssetsPlugin({
    regExp: /\/([^/]+)\/[^\.]+.png$/,
    name: '[1]-[name].[contenthash:8].[ext]'
  })
  ```

### `publicUrl`

Access path prefix for built resource files. ***Once provided, it will take effect, even while building the cjs and esm formats.***

- Type: `string`
- Default: `''`
- Example:
  ```typescript
  libAssetsPlugin({
    publicUrl: 'https://cdn.jsdelivr.net/npm/@laynezh/vite-plugin-lib-assets'
  })
  ```

### `convertToNewUrl`

Convert asset import statements to `new URL()` form in the output.

- Type: `boolean`
- Default: `false`
- Example:
  ```typescript
  libAssetsPlugin({
    convertToNewUrl: true
  })
  ```

#### Why this option?

When you use the standard ES module syntax to import assets:
```typescript
import logo from './logo.png'
```

By default, this plugin will keep the import statement in the output, which may cause issues in certain environments or build tools that don't handle asset imports well.

With `convertToNewUrl: true`, the output will be converted to:
```typescript
const logo = new URL('./assets/logo.abc123.png', import.meta.url).href
```

This approach:
- ✅ Works in more environments (Node.js ESM, browsers, etc.)
- ✅ More explicit about asset resolution
- ✅ Better compatibility with bundlers and build tools
- ✅ Follows the [WHATWG URL Standard](https://url.spec.whatwg.org/)

#### Limitations with native `new URL()` syntax

⚠️ **Important**: This plugin has limitations when processing assets that are **already written** using the `new URL()` syntax in your source code, **especially in `export * from` scenarios**.

**The main issue occurs with re-exports:**

If you write in your source code:
```typescript
// file: some-module.ts
// ❌ This will NOT be handled correctly when re-exported
export const logo = new URL('./logo.png', import.meta.url).href

// file: index.ts
export * from './some-module'  // ❌ The asset reference may be lost
```

**Why this happens:**
1. Vite's built-in handling of `new URL()` with `import.meta.url` processes the asset before this plugin runs
2. When using `export *`, the module bundling may inline or transform the code in ways that lose the asset reference
3. This plugin primarily tracks `import` statements through the module graph, not runtime `new URL()` calls

**Direct usage of `new URL()` works fine:**
```typescript
// ✅ This works if you DON'T re-export it
const logo = new URL('./logo.png', import.meta.url).href
console.log(logo)
```

**Recommended approach for library authors:**
```typescript
// ✅ Use import syntax, let the plugin convert it
import logo from './logo.png'
export { logo }

// With convertToNewUrl: true, this becomes in the output:
// export const logo = new URL('./assets/logo.abc123.png', import.meta.url).href
```

