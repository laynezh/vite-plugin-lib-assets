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

### 注意

- 如果将 `build.ssr` 设置为 `true`，你应该同时开启 `build.ssrEmitAssets` 来输出资源文件。

## 配置项

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

一个或一组 [picomatch](https://github.com/micromatch/picomatch#globbing-features) 表达式，指明哪些文件需要被插件处理。

- Type: `string | RegExp | (string | RegExp)[]`
- Default: 与 Vite [`assetsInclude`](https://vitejs.dev/config/shared-options.html#assetsinclude) 选项的默认值一样，可以在[这里](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/constants.ts#L91-L135)找到完整的列表。
- Example:
  ```typescript
  libAssetsPlugin({
    include: /\.a?png(\?.*)?$/
  })
  ```

### `exclude`

和 `include` 一样，但是用来指明哪些文件需要被插件忽略。

- Type: `string | RegExp | (string | RegExp)[]`
- Default: `undefined`.
- Example:
  ```typescript
  libAssetsPlugin({
    exclude: /\.svg(\?.*)?$/
  })
  ```

### name

资源文件的输出名称，与 `file-loader` 的 [`name`](https://github.com/webpack-contrib/file-loader#name) 配置行为一致

- Type: `string
- Default: `'[contenthash].[ext]'`
- Example:
  ```typescript
  assetsLibPlugin({
    name: '[name].[contenthash:8].[ext][query]'
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

### `outputPath`

指定资源共用的输出路径

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

### `convertToNewUrl`

将资源的 import 语句转换为 `new URL()` 形式输出。

- Type: `boolean`
- Default: `false`
- Example:
  ```typescript
  assetsLibPlugin({
    convertToNewUrl: true
  })
  ```

#### 为什么需要这个选项？

当你使用标准的 ES 模块语法导入资源时：
```typescript
import logo from './logo.png'
```

默认情况下，插件会在输出文件中保留这个 import 语句，这可能会在某些环境或构建工具中引发问题，因为不是所有工具都能正确处理资源的 import 语句。

启用 `convertToNewUrl: true` 后，输出会被转换为：
```typescript
const logo = new URL('./assets/logo.abc123.png', import.meta.url).href
```

这种方式：
- ✅ 在更多环境中工作（Node.js ESM、浏览器等）
- ✅ 对资源解析更加明确
- ✅ 与打包工具和构建工具有更好的兼容性
- ✅ 遵循 [WHATWG URL 标准](https://url.spec.whatwg.org/)

#### 处理原生 `new URL()` 写法的限制

⚠️ **重要提示**：本插件在处理源代码中**已经使用** `new URL()` 语法编写的资源时存在限制，**特别是在 `export * from` 场景下**。

**主要问题出现在重导出时：**

如果你在源代码中这样写：
```typescript
// 文件: some-module.ts
// ❌ 当被重导出时，插件无法正确处理这种写法
export const logo = new URL('./logo.png', import.meta.url).href

// 文件: index.ts
export * from './some-module'  // ❌ 资源引用可能会丢失
```

**为什么会这样：**
1. Vite 内置的 `new URL()` 与 `import.meta.url` 处理在本插件运行之前就已经执行
2. 使用 `export *` 时，模块打包可能会内联或转换代码，导致资源引用丢失
3. 本插件主要通过模块依赖图追踪 `import` 语句，而不是运行时的 `new URL()` 调用

**直接使用 `new URL()` 是可以的：**
```typescript
// ✅ 如果不重导出它，这样写是可以的
const logo = new URL('./logo.png', import.meta.url).href
console.log(logo)
```

**库作者的推荐做法：**
```typescript
// ✅ 使用 import 语法，让插件来转换它
import logo from './logo.png'
export { logo }

// 启用 convertToNewUrl: true 后，输出中会变成：
// export const logo = new URL('./assets/logo.abc123.png', import.meta.url).href
```

