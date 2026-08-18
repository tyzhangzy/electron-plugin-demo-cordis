# electron-plugin-demo-cordis

基于 **Cordis 框架**（`@cordisjs/core`）对 `electron-plugin-demo` 的插件化架构重构。

## 重构动机

原 demo 手写了一套插件管理器（目录扫描、依赖解析、生命周期、事件总线、副作用清理）。
Cordis 内置了其中大部分能力且更完善。重构后：

| 原 demo（手写） | 重构后（Cordis） |
|------|------|
| `plugin-manager.ts`（扫描/依赖/拓扑排序） | `ctx.plugin()` + `inject[]` |
| 手写 `EventEmitter pluginBus` | `ctx.emit` / `ctx.on`（类型化、可短路） |
| 手写 `PluginRegistration` 副作用清理 | `ctx.effect()` 自动清理 |
| 手写 `commandRegistry` | `CommandService`（Cordis Service） |
| 手写 `config.json` 读取 | schemastery `Schema` 校验 |
| 手写菜单/IPC 管理 | `MenuService` / `IpcService` |

**唯一保留的手写桥接层**：`src/host/loader.ts`（目录扫描 + plugin.json → Cordis 插件对象），
这是 Cordis 不原生支持、但插件系统的价值所在。

## 目录结构

```
electron-plugin-demo-cordis/
├── src/
│   ├── main.ts              # Electron 主进程（Cordis 宿主）
│   ├── preload.ts           # contextBridge 安全桥（ESM）
│   ├── renderer.ts          # 渲染层 UI（复用原 demo）
│   ├── host/
│   │   ├── types.ts         # 类型合并 + Events 事件声明
│   │   ├── loader.ts        # 目录扫描 → Cordis 插件（手写桥接层）
│   │   └── services/
│   │       ├── command.ts   # CommandService
│   │       ├── menu.ts      # MenuService
│   │       └── ipc.ts       # IpcService
│   └── plugins/             # 每个插件 = plugin.json + index.ts（ESM default export）
├── scripts/
│   ├── copy-assets.mjs      # 构建：拷贝静态资源到 dist/
│   └── headless-smoke.mjs   # 无 GUI 冒烟测试（验证 loader+DI+命令）
├── config.json              # 中央插件开关（schemastery 校验）
├── index.html / style.css   # 渲染层（复用原 demo）
├── package.json / tsconfig.json
```

## 插件写法

```ts
import { Context } from "@cordisjs/core";

const NAME = "my-plugin";

export default {
  name: NAME,
  inject: ["commands", "menu", "ipc"], // Cordis 依赖注入
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "my.cmd",
      title: "My Command",
      description: "...",
      handler: (params: any) => ({ ok: true }),
    });
    ctx.menu.registerMenu("My", [{ label: "...", click: () => ctx.emit("ui/message", {...}) }], NAME);
    ctx.ipc.handle("my:ping", () => "pong");
  },
};
```

## 构建 / 运行 / 验证

```bash
npm install                 # 安装依赖（@cordisjs/core, schemastery, typescript...）

npm run build               # tsc 编译 src -> dist/ + 拷贝静态资源
npm run typecheck           # 仅类型检查
npm start                   # 构建后用 electron 启动

# 无 GUI 冒烟测试（验证 loader + 依赖注入 + 命令调用）
npm run build && node scripts/headless-smoke.mjs
```

> **运行 Electron**：`npm start` 依赖 `electron` 可执行文件。
> - 若已执行 `npm install` 且 electron 二进制下载完成，直接 `npm start`；
> - 也可复用原工程打包好的运行时：`..\electron-plugin-demo\electron.exe .`。

## 热重载（Hot-Reload）

- **插件目录变化** → 单个插件被 **dispose + 重新注册**（基于 Cordis `fiber.dispose()`，ESM 用 `?t=` 破 import 缓存）；
- **config.json 变化** → **全量重载**；
- 命令 / 菜单 / IPC 副作用按**插件名**清理（`CommandService` / `MenuService` / `IpcService` 的 `clearByPlugin`），
  因此 reload 不会残留旧注册；
- 重载后重建应用菜单并向渲染层推送 `plugins:reload`，UI 自动刷新。

## 冒烟测试说明

`headless-smoke.mjs` 不依赖 Electron/GUI，验证：目录扫描加载、Cordis 依赖注入、
插件 `apply()` 执行、命令调用，以及**热重载**（`reloadPlugin` 后命令仍可用）。
其中 `hello/clock/math` 插件 `inject` 了需要 Electron 的 `menu/ipc` 服务，在 headless 下保持
PENDING（正常现象）；真实 Electron 运行时会加载。
