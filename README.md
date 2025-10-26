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

### Scope

- This plugin won't rewrite asset `import` statements (for example, `import icon from './icon.svg'`) into `new URL('./icon.svg', import.meta.url)`. That transformation is handled by Vite's built-in asset pipeline or other dedicated plugins. `@laynezh/vite-plugin-lib-assets` focuses on extracting the files once they are referenced during a library build.

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
