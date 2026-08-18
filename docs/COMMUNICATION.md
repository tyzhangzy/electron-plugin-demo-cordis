# 进程通信机制说明

> 本文档解释 `electron-plugin-demo-cordis` 中 **Cordis** 与 **Electron 进程**之间的通信是如何组织的。
> 重点：分清"Cordis 主进程内通信"与"Electron 跨进程 IPC"两个层面。

---

## 1. 两个层面，不要混淆

| 层面 | 机制 | 范围 |
|------|------|------|
| **Cordis 通信** | 依赖注入（`inject[]`）、事件总线（`ctx.emit`/`ctx.on`）、服务调用 | **仅主进程内** |
| **Electron 跨进程通信** | IPC（`ipcMain` / `ipcRenderer` / `webContents`） | 主进程 ↔ 渲染进程 |

**关键结论**：Cordis **本身不处理跨进程通信**。它运行在主进程里，是一个依赖注入容器 / 插件宿主。
跨进程通信用的是 **Electron 的 IPC**，项目通过 `preload`（contextBridge 安全桥）和 `IpcService`（Cordis 服务）把它衔接起来。

---

## 2. 整体架构（谁在哪个进程）

```
┌──────────────────────────────────────────────────────────────┐
│ 渲染进程 (renderer.ts)                                        │
│   通过 window.plugins 访问（contextBridge 暴露的安全 API）      │
│   window.plugins.list() / invoke() / on() / log()             │
└───────────────▲───────────────────────────────┬──────────────┘
                │ ipcRenderer (preload.ts)      │ webContents.send (IpcService)
┌───────────────┴───────────────────────────────▼──────────────┐
│ 主进程 (main.ts) ── Cordis Context（宿主）                     │
│   ctx.commands  → CommandService   命令注册/调用               │
│   ctx.menu      → MenuService      菜单                        │
│   ctx.ipc       → IpcService       IPC 封装 + 主→渲染推送      │
│   ctx.emit/on   → 事件总线          插件间通信（仅主进程内）     │
│   createLoader  → loader           插件加载 / 热重载            │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 渲染进程 → 主进程：调用插件命令（请求-响应）

以点击按钮调用 `hello.greet` 为例：

```
1. renderer.ts      window.plugins.invoke("hello.greet", {...})
2. preload.ts       ipcRenderer.invoke("plugin:invoke", { commandId, params })
        │   ↑ Electron IPC（invoke/handle 是一对请求-响应）
3. main.ts          ipcMain.handle("plugin:invoke", (_, p) => ctx.commands.invoke(p.commandId, p.params))
4. CommandService   entries.get(id).handler(params)   ← Cordis 服务
5. 返回 Promise 结果，沿原路回传到渲染进程
```

- **渲染 → 主**：`preload.ts` 中的 `ipcRenderer.invoke`；
- **主进程处理**：`main.ts` 的 `registerIpc()` 注册 `ipcMain.handle("plugin:invoke", ...)`；
- **实际执行**：交给 **Cordis 的 `CommandService`**（`ctx.commands.invoke`），命令由插件通过 `ctx.commands.register` 注册。

`window.plugins.list()` 同理：`ipcRenderer.invoke("plugin:list")` → `main.ts` → `loader.list()`。

> 此处 Cordis 的角色：`main.ts` 只把 IPC 收到的请求**转交给 Cordis 服务**（`ctx.commands`），
> 真正执行的是 Cordis 管理的插件命令。IPC 本身是 Electron 的。

---

## 4. 主进程 → 渲染进程：推送（事件通知）

插件主动向界面推数据（例如 `clock-plugin` 菜单点击后推当前时间）：

```
1. clock-plugin     ctx.ipc.send("clock:menu", { now, from })
2. IpcService       mainWindow.webContents.send(channel, data)   ← Electron
3. preload.ts       ipcRenderer.on("clock:menu", listener)
4. renderer.ts      window.plugins.on("clock:menu", cb) 注册的回调被触发
```

- 插件使用 **`ctx.ipc.send`**——`IpcService` 封装为 `webContents.send`；
- 渲染侧通过 `preload` 暴露的 `window.plugins.on(channel, cb)` 订阅（内部为 `ipcRenderer.on`）。

---

## 5. 插件自定义 IPC 通道

插件可注册自己的 IPC 通道，例如 `hello-plugin`：

```ts
ctx.ipc.handle(NAME, "hello:ping", () => "pong");
```

`IpcService.handle` 内部即 `ipcMain.handle("hello:ping", ...)`（Electron）。
这样插件**无需直接 import Electron**，而是通过 Cordis 注入的 `ctx.ipc` 服务使用 IPC。

---

## 6. 主进程内部：Cordis 自身的"通信"（不跨进程）

这部分才是 **Cordis 框架的通信**，仅发生在主进程内：

- **插件间事件总线**：`event-publisher-plugin` 用 `ctx.emit("demo:message", data)` 发布，
  `event-subscriber-plugin` 用 `ctx.on("demo:message", cb)` 订阅。这是 Cordis 事件系统，
  **不经过 Electron IPC**，只在主进程内存内传递。
- **依赖注入**：插件用 `inject: ["commands", ...]` 声明依赖，Cordis 启动时解析并注入。
- **跨插件调用命令**：`report-plugin` 用 `ctx.commands.invoke("math.add", ...)` 调其他插件命令，
  同样走 `CommandService`，主进程内直接调用。

---

## 7. 安全桥：preload + contextBridge

安全模型（`main.ts` 的 `webPreferences`）：

- `nodeIntegration: false` + `contextIsolation: true`；
- **渲染进程无法直接访问 Node / Electron**，只能调用 `preload.ts` 用
  `contextBridge.exposeInMainWorld("plugins", {...})` 暴露的 `window.plugins`
  （白名单 API：`list` / `invoke` / `on` / `log`）；
- `sandbox: false` 是因为使用了 ESM preload。

渲染进程看到的既不是 Cordis，也不是完整 Electron，而是**一个很小的、经过过滤的 `window.plugins` 接口**——
这正是插件系统的安全边界。

---

## 8. 小结

| 通信方向 | 用什么机制 | Cordis 的角色 |
|---------|-----------|--------------|
| 渲染 → 主（命令调用/列表） | Electron IPC `invoke` / `handle` | 主进程侧由 `ctx.commands` / `loader` 处理 |
| 主 → 渲染（推送） | Electron `webContents.send` / `ipcRenderer.on` | 封装在 `IpcService.send` |
| 插件自定义 IPC | Electron `ipcMain.handle` | 封装在 `IpcService.handle` |
| 插件 ↔ 插件（事件） | **Cordis 事件总线**（`ctx.emit`/`ctx.on`） | Cordis 原生，仅主进程内 |
| 插件 → 服务（依赖） | **Cordis 依赖注入**（`inject[]`） | Cordis 原生，仅主进程内 |

**一句话总结**：Cordis 是**主进程内**的插件 / 服务 / 事件框架；跨进程通信全部由 **Electron IPC** 承担，
项目用 `preload`（contextBridge 安全桥）给渲染进程一个 `window.plugins` 接口，再用 **`IpcService`**
把 Electron 的 IPC 封装成插件可用的 `ctx.ipc`，使"插件既用得上跨进程能力，又不必直接碰 Electron API"。
