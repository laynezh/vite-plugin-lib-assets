[English](https://github.com/laynezh/vite-plugin-lib-assets/blob/main/README.md) | 中文

# @laynezh/vite-plugin-lib-assets

Vite 插件：用于提取 [`library mode`](https://vitejs.dev/guide/build.html#library-mode) 构建时引用到的资源文件，而不是以 base64 形式內联它们

## 安装

```bash
npm i @laynezh/vite-plugin-lib-assets -D
```

或

```bash
yarn add @laynezh/vite-plugin-lib-assets -D
```

或

```bash
pnpm add @laynezh/vite-plugin-lib-assets -D
```

## 使用

```typescript
// vite.config.ts
import libAssets from '@laynezh/vite-plugin-lib-assets'

export default defineConfig({
  plugins: [
    libAssets({ /* options */ }),
  ],
})
```

Example: [`playground/`](./playground/)

## 配置项

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

### name

资源文件的输出名称，与 `file-loader` 的 [`name`](https://github.com/webpack-contrib/file-loader#name) 配置行为一致

- Type: `string | ((resourcePath: string, resourceQuery: string) => string)`
- Default: `'[contenthash].[ext]'`
- Example:
  - `string`
    ```typescript
    assetsLibPlugin({
      name: '[name].[contenthash:8].[ext]?[query]'
    })
    ```
  - `function`
    ```typescript
    assetsLibPlugin({
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
> 完整的占位符列表见 [`loader-utils#interpolatename`](https://github.com/webpack/loader-utils#interpolatename)

### `limit`

低于 `limit` 设置体积的文件会以 base64 的格式內联到产物中

- Type: `number`，单位 `Byte`
- Default: `undefined`，表示所有文件都不会被内联
- Example:
  ```typescript
  assetsLibPlugin({
    limit: 1024 * 8 // 8KB
  })
  ```

### `extensions`

需要处理的资源文件类型

- Type: `string[]`
- Default: `['.jpg', '.jpeg', '.png', '.apng', '.gif', '.bmp', '.svg', '.webp']`
- Example:
  ```typescript
  assetsLibPlugin({
    // 仅处理以下文件
    extensions: ['.jpg', '.png', '.webp']
  })
  ```

### `outputPath`

指定资源共用的输出路径，用法与 `file-loader` 的 [`outputPath`](https://github.com/webpack-contrib/file-loader#publicpath) 配置一致

- Type: `string | ((url: string, resourcePath: string, resourceQuery: string) => string)`
- Default: `Vite` 的 [`assetsDir`](https://vitejs.dev/config/build-options.html#build-assetsdir) 配置
- Example:
  - `string`
    ```typescript
    assetsLibPlugin({
      outputPath: 'images'
    })
    ```
  - `function`
    ```typescript
    assetsLibPlugin({
      outputPath: (url, resourcePath, resourceQuery) => {
        // `url` - 经过 `name` 处理替换后的地址，如：`logo.fb2133.png`
        // `resourcePath` - `/absolute/path/to/file.js`
        // `resourceQuery` - `foo=bar`

        return url.endsWith('.png') ? 'image' : 'assets'
      },
    })
    ```

### `regExp`

使用正则从文件完整路径上提取部分内容（捕获组），然后在 `name` 中使用 `[N]` 来进行引用替换，用法与 `file-loader` 的 [`regexp`](https://github.com/webpack-contrib/file-loader#regexp) 配置一致

- Type: `RegExp`
- Default: `undefined`
- Example:
  ```typescript
  // 提取文件的目录名拼在输出文件的前面，使用 - 分隔
  assetsLibPlugin({
    regExp: /\/([^/]+)\/[^\.]+.png$/,
    name: '[1]-[name].[contenthash:8].[ext]'
  })
  ```

### `publicUrl`

资源部署到 CDN 时的路径前缀，***这个选项在构建 `cjs` 和 `esm` 格式时也会生效***

- Type: `string`
- Default: `''`
- Example:
  ```typescript
  assetsLibPlugin({
    publicUrl: 'https://cdn.jsdelivr.net/npm/@laynezh/vite-plugin-lib-assets'
  })
  ```