# electron-plugin-demo → Cordis 重构说明

> 本仓库将原 `electron-plugin-demo`（手写插件系统的 Electron + Node.js 插件化 Demo）
> 基于 **Cordis 框架**（`@cordisjs/core`）进行了等价重构。
> 本文档记录重构的背景、架构设计、关键决策、过程中修复的问题以及验证结果。

---

## 1. 背景与目标

**原项目**：一个用 TypeScript 手写插件系统的 Electron 应用。宿主在启动时扫描 `plugins/` 目录，
每个插件通过宿主提供的 `ctx` 注册命令 / 菜单 / IPC；渲染层通过统一接口调用。

**原实现中手写自研的部分**：插件管理器（目录扫描、依赖解析与拓扑排序、semver 版本检查、生命周期）、
事件总线（`EventEmitter`）、副作用清理（`PluginRegistration`）、中央配置读取、热重载。

**重构目标**：
- 用成熟的 Cordis 框架接管**依赖注入、生命周期、事件系统、插件组合**等通用能力；
- 保留并精简原项目独有的**"目录 + manifest + 入口"动态加载**能力；
- 保持对外行为与运行结果**与原项目一致**（等价迁移）；
- 获得更强的类型安全、可维护性与扩展性。

---

## 2. 技术选型：为什么用 Cordis

Cordis（`@cordisjs/core`）是 Koishi 生态的核心框架，提供：

| 能力 | 说明 |
|------|------|
| `Context` | 依赖注入容器，一切插件的宿主 |
| `ctx.plugin()` | 注册插件，返回 `ForkScope`（可 dispose 实现热重载） |
| `inject[]` | 声明服务依赖；缺服务时插件保持 PENDING 不执行 |
| `Service` 子类 | 定义可注入的服务（`ctx.xxx`），类型安全 |
| `ctx.effect()` | 副作用注册 + 自动清理（生命周期） |
| `ctx.emit` / `ctx.on` | 类型化事件总线（支持串行 / 短路） |
| schemastery `Schema` | 配置校验与默认值 |

**核心判断**：原项目手写的插件管理器（依赖解析、生命周期、事件、清理）在 Cordis 中**大部分内置且更完善**。
真正需要保留的自研部分只有"目录扫描 → 把 `plugin.json` + 入口包装成 Cordis 插件"这一层桥接。

---

## 3. 重构前后架构对比

### 3.1 原项目（手写）

```
main.ts (宿主) ── plugin-manager.ts (扫描/依赖/生命周期)
     │              │
     ├── commandRegistry / Menu / IPC   （手写管理）
     ├── pluginBus (EventEmitter)       （手写事件总线）
     └── plugins/  每个插件 = plugin.json + index.ts (CommonJS `export =`)
```

### 3.2 重构后（Cordis）

```
main.ts (宿主)
   │  new Context()
   │  ctx.plugin(CommandService / MenuService / IpcService)   ← Cordis Service
   │  createLoader(ctx, dir, getConfig)                        ← 唯一手写桥接层
   │  ctx.start()  → 依赖注入、生命周期、事件由 Cordis 接管
   └── plugins/  每个插件 = plugin.json + index.ts (ESM `export default { name, inject, apply }`)
```

---

## 4. 目录结构（重构版）

```
electron-plugin-demo-cordis/
├── src/
│   ├── main.ts              # Electron 主进程（Cordis 宿主）
│   ├── preload.ts           # contextBridge 安全桥（ESM）
│   ├── renderer.ts          # 渲染层（复用原项目）
│   ├── host/
│   │   ├── types.ts         # 类型合并 + Events 事件声明
│   │   ├── loader.ts        # createLoader：目录扫描 → Cordis 插件（手写桥接层）
│   │   └── services/
│   │       ├── command.ts   # CommandService
│   │       ├── menu.ts      # MenuService
│   │       └── ipc.ts       # IpcService
│   └── plugins/             # 14 个示例插件（ESM default export）
├── scripts/
│   ├── copy-assets.mjs      # 构建：拷贝静态资源到 dist/
│   ├── headless-smoke.mjs   # 无 GUI 冒烟测试（含热重载验证）
│   ├── list-plugins.mjs     # CLI：列出插件
│   └── toggle-plugin.mjs    # CLI：切换插件启用状态（验证 config 热重载）
├── config.json              # 中央插件开关（schemastery 校验）
├── index.html / style.css   # 渲染层（复用原项目）
└── docs/
    ├── MIGRATION.md         # 新旧功能/目录映射对照表
    └── REFACTORING.md       # 本文档
```

---

## 5. 插件开发方式

```ts
import { Context } from "@cordisjs/core";

const NAME = "my-plugin";

export default {
  name: NAME,
  inject: ["commands", "menu", "ipc"],  // Cordis 依赖注入
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME, id: "my.cmd", title: "My Command", description: "...",
      handler: (params: any) => ({ ok: true }),
    });
    ctx.menu.registerMenu("My", [{ label: "...", click: () => ctx.emit("ui/message", {...}) }], NAME);
    ctx.ipc.handle(NAME, "my:ping", () => "pong");
  },
};
```

配套 `plugin.json`（新增 `inject` 字段）：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My plugin",
  "main": "index.js",
  "enabled": true,
  "functions": ["my.cmd"],
  "inject": ["commands", "menu", "ipc"]
}
```

---

## 6. 关键设计点与注意事项

1. **服务访问必须在 `ctx.start()` 之后**
   Cordis 只在 `start` 时才通过 `ctx.set()` 提供服务（`ctx.commands` / `ctx.menu` / `ctx.ipc`）。
   在 `start` 之前访问它们会是 `undefined`（本次重构遇到的实际问题，见 §7）。

2. **插件名显式传递**
   服务方法无法感知"谁在调用"（`Service` 实例的 `ctx` 是服务注册时的根作用域），
   因此命令 / 菜单 / IPC 注册需要插件显式传自己的名字，便于按插件名清理。

3. **配置文件动态读取**
   `createLoader(ctx, dir, getConfig)` 用 `getConfig()` 每次加载时读最新配置，
   使 `config.json` 热重载真正生效（若用构造时快照，则 reload 不会应用新配置）。

4. **ESM 模块系统**
   工程为 `"type":"module"`（NodeNext）。相对导入需带 `.js` 扩展名；插件用 `export default`。
   渲染脚本 `index.html` 需用 `<script type="module">` 加载（因为 tsc 会给模块文件追加 `export {};`）。

5. **热重载的副作用清理**
   命令 / 菜单 / IPC 按插件名记录，卸载时由 loader 调用
   `CommandService / MenuService / IpcService` 的 `clearByPlugin()` 清理，避免残留旧注册。

6. **headless 兼容**
   `unloadOne` 对 `menu` / `ipc` 服务用可选链访问，便于在无 Electron 的纯 Node 环境做冒烟测试。

---

## 7. 重构过程中发现并修复的问题

| # | 问题 | 现象 | 修复 |
|---|------|------|------|
| 1 | loader 把 `mod.default`（插件对象）错当 apply 函数 | 命令未注册 | 正确提取 `apply` 或直接用 default 插件对象 |
| 2 | `createLoader` 漏调 `await loadAll()` | 初始不加载任何插件 | 补上 `await loadAll()` |
| 3 | headless 下 `ctx.menu/ipc` 未注册 | `clearByPlugin` 报 `undefined` | 对 menu/ipc 用可选链安全访问 |
| 4 | `setPluginMenuProvider` 在 `start` 前调用 | `ctx.menu` 为 `undefined`（TypeError） | 移到 `await ctx.start()` 之后 |
| 5 | `renderer.js` 被编译为 ESM（含 `export {}`） | 渲染层 `Unexpected token 'export'` | `index.html` 用 `<script type="module">` |
| 6 | config 作为构造快照 | `config.json` 热重载不生效 | 改为 `getConfig()` 动态读取 |

---

## 8. 功能与验证清单

**功能（与原项目一致）**：插件目录动态加载、命令注册/调用、菜单、IPC（含插件自定义通道）、
主→渲染推送、插件间事件总线、跨插件命令调用、中央配置开关、热重载、原生对话框。

**验证（headless 冒烟 `scripts/headless-smoke.mjs`，exit 0）**：
- 目录扫描 + 动态 import + 注册（13 个插件，`sample-disabled` 正确跳过）
- 依赖注入（仅 `commands` 时命令类插件正常执行）
- 命令调用（`date.today` / `note.upper` 等）
- 事件总线（`event-publisher` / `event-subscriber`）
- 跨插件命令调用（`report-plugin`）
- 热重载（`reloadPlugin` 后命令仍可用）

**验证（真实 Electron 启动）**：`npm start` 正常打开窗口，STDERR 无错误，
全部 13 个插件（含需 `menu/ipc` 服务的 `hello/clock/math`）成功 `activate()`，
运行结果与原 `electron-plugin-demo` 一致。

**CLI**：`npm run list-plugins` / `npm run toggle-plugin <name> <true|false>`。

---

## 9. 构建 / 运行 / 测试

```bash
npm install                 # 安装依赖
npm run build               # tsc 编译 src -> dist/ + 拷贝静态资源
npm run typecheck           # 类型检查
npm start                   # 构建后启动 Electron（或用 ..\electron-plugin-demo\electron.exe .）
npm run smoke               # 无 GUI 冒烟测试（headless，含热重载验证）
npm run list-plugins        # 列出插件
npm run toggle-plugin <name> <true|false>
```

---

## 10. 后续扩展方向

- 将 `MenuService` / `IpcService` 纳入带 Electron 的自动化运行时验证；
- 插件打包为 `.asar` / zip 分发与校验；
- 每插件独立配置面板（schemastery 生成 UI）；
- 插件版本冲突检测（当前用 `inject[]` 服务级依赖，无版本语义）。

