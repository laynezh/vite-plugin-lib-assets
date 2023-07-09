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

**Notice**: The plugin only accepts either `Array<'es' | 'cjs'>` or `Array<'umd' | 'iife'>` as the `build.lib.formats` option. If you wish to build both `es` and `umd` formats, please create separate builds for each.

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

## Option

```typescript
export interface Options {
  name?: string | ((resourcePath: string, resourceQuery: string) => string)
  limit?: number
  extensions?: string[]
  outputPath?: string | ((url: string, resourcePath: string, resourceQuery: string) => string)
  regExp?: RegExp
  publicUrl?: string
}
```

### `name`

Output name of the resource file, its usage aligns with the [`name`](https://github.com/webpack-contrib/file-loader#name) option of the `file-loader`.

- Type: `string | ((resourcePath: string, resourceQuery: string) => string)`
- Default: `'[contenthash].[ext]'`
- Example:
  - `string`
    ```typescript
    libAssetsPlugin({
      name: '[name].[contenthash:8].[ext]?[query]'
    })
    ```
  - `function`
    ```typescript
    libAssetsPlugin({
      name: (resourcePath, resourceQuery) => {
        // `resourcePath` - `/absolute/path/to/file.js`
        // `resourceQuery` - `foo=bar`

        if (process.env.NODE_ENV === 'development') {
          return '[name].[ext]';
        }

        return  '[name].[contenthash:8].[ext]?[query]'
      },
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

### `extensions`

File types to be processed.

- Type: `string[]`
- Default: `['.jpg', '.jpeg', '.png', '.apng', '.gif', '.bmp', '.svg', '.webp']`
- Example:
  ```typescript
  libAssetsPlugin({
    // Only process the following file types
    extensions: ['.jpg', '.png', '.webp']
  })
  ```

### `outputPath`

Specify the output path where the extracted files will be placed, its usage aligns with the [`outputPath`](https://github.com/webpack-contrib/file-loader#publicpath) option of the `file-loader`.

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
        // `resourceQuery` - `foo=bar`

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

Access path prefix for built resource files in the browser. ***Applies exclusively to `umd | iife` format builds.***

- Type: `string`
- Default: `''`
- Example:
  ```typescript
  libAssetsPlugin({
    publicUrl: 'https://cdn.jsdelivr.net/npm/@laynezh/vite-plugin-lib-assets'
  })
  ```