# electron-plugin-demo → electron-plugin-demo-cordis 迁移对照

本文档记录从手写插件系统（原 demo）到 Cordis 重构版的功能映射、目录对应、关键差异与已验证能力。

## 1. 功能对照

| 能力 | 原 demo（手写） | Cordis 重构版 | 说明 |
|------|------|------|------|
| 插件宿主 | `main.ts` 手写 | `main.ts`（Cordis 宿主） | Cordis 接管 DI/生命周期 |
| 目录扫描加载 | `plugin-manager.ts` | `host/loader.ts`（唯一手写桥接层） | Cordis 不原生支持目录加载 |
| 依赖解析/拓扑排序 | 手写 `resolveLoadOrder` + semver | `inject[]` | Cordis 服务级依赖注入 |
| 生命周期清理 | 手写 `PluginRegistration` + `onUnload` | `clearByPlugin`（按插件名）+ fiber dispose | 由 loader 显式清理 |
| 命令注册/调用 | `commandRegistry` | `CommandService` | Cordis Service |
| 菜单 | 手写 `buildMenu` | `MenuService` | 插件命令自动列出 |
| IPC（含插件自定义通道） | `handleIpc` | `IpcService` | 按插件名跟踪 channel |
| 主→渲染推送 | `ctx.send` | `ctx.ipc.send` | 同语义 |
| 插件间事件总线 | 手写 `EventEmitter pluginBus` | `ctx.emit` / `ctx.on` | 类型化、可短路 |
| 跨插件命令调用 | `ctx.invokeCommand` | `ctx.commands.invoke` | 依赖注入可直接 `ctx[svc]` |
| 中央配置开关 | 手写读取 `config.json` | schemastery `Schema` + 动态读取 | config 热重载生效 |
| 原生对话框 | `ctx.showMessage` | `ctx.emit("ui/message")` → 宿主弹窗 | 插件不直接碰 Electron |
| 热重载 | `reloadPlugin`（清 require cache） | `fiber.dispose()` + `?t=` 破 ESM 缓存 | 单插件/全量 |
| CLI 工具 | `list_plugins` / `toggle_plugin` | `list-plugins` / `toggle-plugin` | headless 可跑 |

## 2. 目录 / 文件映射

| 原 demo | Cordis 重构版 |
|------|------|
| `src/main.ts` | `src/main.ts`（Cordis 宿主） |
| `src/plugin-manager.ts` | `src/host/loader.ts`（`createLoader`） |
| `src/plugin-types.ts` | `src/host/types.ts` + `services/*` |
| `src/preload.ts` / `src/renderer.ts` | 复用（基本不变） |
| `src/plugins/<name>/index.ts`（CommonJS `export =`） | `src/plugins/<name>/index.ts`（ESM `export default { name, inject, apply }`） |
| `src/plugins/<name>/plugin.json` | 保留（新增 `inject` 字段） |
| `config.json` | 保留（schemastery 校验） |

## 3. 关键差异（迁移时注意）

1. **模块系统**：原 demo 为 CommonJS（`"type":"commonjs"` + `export = plugin`）；
   Cordis 版为 **ESM**（`"type":"module"` + `export default`，NodeNext）。相对导入需带 `.js` 扩展名。
2. **插件签名**：原 `activate(ctx)` / `deactivate(ctx)` → Cordis 的 `{ name, inject, apply(ctx) }`；
   清理靠 loader 的 `clearByPlugin` + `fiber.dispose()`。
3. **插件名显式传递**：`ctx.commands.register({ plugin, id, ... })` / `ctx.menu.registerMenu(label, submenu, plugin)` /
   `ctx.ipc.handle(plugin, channel, fn)` 需要插件显式传自己的名字（服务方法无法感知调用者作用域）。
4. **配置文件动态读取**：`createLoader(ctx, dir, getConfig)` 用 `getConfig()` 每次加载时读最新配置，
   使 `config.json` 热重载真正生效（旧实现是构造快照，reload 不生效）。
5. **服务注入**：插件用 `inject: ["commands","menu","ipc"]` 声明依赖；缺服务时 Cordis 使其保持 PENDING 不执行
   （headless 下 `menu/ipc` 未注册即此情形）。
6. **headless 兼容**：`loader.unloadOne` 对 `menu/ipc` 用可选链，缺服务时安全。

## 4. 已验证能力（headless 冒烟）

- 目录扫描 + 动态 import + 注册（13 个插件，`sample-disabled` 正确跳过）
- 依赖注入（仅 commands 时，命令类插件正常执行）
- 命令调用（`date.today` / `note.upper` 等）
- 事件总线（`event-publisher` / `event-subscriber`）
- 跨插件命令调用（`report-plugin`）
- 热重载（`reloadPlugin` 后命令仍可用）
- config 热重载（`toggle-plugin` off→disabled / on→loaded）

## 5. 扩展方向

- 将 `MenuService` / `IpcService` 纳入带 Electron 的运行时验证（真实窗口）；
- 插件打包为 `.asar` / zip 分发与校验；
- 每个插件独立配置面板（schemastery UI）；
- 插件版本冲突检测（目前用 `inject[]` 服务级依赖，无版本语义）。
