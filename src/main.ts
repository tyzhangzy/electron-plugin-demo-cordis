import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { Context } from "@cordisjs/core";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import Schema from "schemastery";
import { CommandService } from "./host/services/command.js";
import { MenuService } from "./host/services/menu.js";
import { IpcService } from "./host/services/ipc.js";
import { createLoader, type PluginLoader } from "./host/loader.js";

/**
 * main.ts - Electron main process (the Cordis host).
 *
 * Cordis replaces the hand-written plugin manager from the original demo:
 *   - services (command / menu / ipc) are Cordis Services
 *   - dependency injection is handled by inject[]
 *   - lifecycle + cleanup is handled by ctx.effect()
 *   - inter-plugin events use ctx.emit / ctx.on
 * The only hand-written bridge left is host/loader.ts (directory scanning).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, "plugins");
const CONFIG_PATH = path.join(__dirname, "config.json");

/** schemastery-validated central config. */
const ConfigSchema = Schema.object({
  plugins: Schema.dict(Schema.object({ enabled: Schema.boolean().default(true) })).default({}),
});

function readConfig(): any {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return ConfigSchema(raw);
  } catch (e: any) {
    console.log("[host] config.json missing/invalid; using defaults. ", e?.message ?? "");
    return { plugins: {} };
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow(ctx: Context): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // required for ESM preload script
    },
  });

  ctx.ipc.setWindow(mainWindow);

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.on("console-message", (_e, level, message) => {
    console.log(`[renderer-console][${level}]`, message);
  });
}

/** Build the "Plugins" submenu: one entry per loaded plugin with commands. */
function buildPluginMenu(ctx: Context, loader: PluginLoader): any[] {
  const menu: any[] = [];
  for (const r of loader.records()) {
    if (r.reason !== "") continue;
    const cmds = ctx.commands.listByPlugin(r.name);
    if (!cmds.length) continue;
    menu.push({
      label: r.name,
      submenu: cmds.map((c) => ({
        label: c.title,
        click: async () => {
          const result = await ctx.commands.invoke(c.id, { from: "menu" });
          dialog.showMessageBox(mainWindow!, {
            type: "info",
            title: `[${r.name}] ${c.title}`,
            message: JSON.stringify(result, null, 2),
          });
        },
      })),
    });
  }
  return menu;
}

/** Register the two generic IPC channels (renderer -> main). */
function registerIpc(ctx: Context, loader: PluginLoader): void {
  for (const ch of ["plugin:list", "plugin:invoke"]) {
    try { ipcMain.removeHandler(ch); } catch { /* noop */ }
  }
  ipcMain.handle("plugin:list", () => loader.list());
  ipcMain.handle("plugin:invoke", (_event, payload) => {
    const { commandId, params } = payload || {};
    return ctx.commands.invoke(commandId, params);
  });
}

/** Hot-reload watcher: dispose + re-register a plugin (or all) when files change. */
function watch(ctx: Context, loader: PluginLoader): void {
  const refresh = () => {
    ctx.menu.rebuild();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("plugins:reload");
  };

  let timer: NodeJS.Timeout | null = null;
  if (fs.existsSync(PLUGINS_DIR)) {
    fs.watch(PLUGINS_DIR, { recursive: true }, async (_eventType, filename) => {
      if (!filename) return;
      const parts = filename.replace(/\\/g, "/").split("/");
      const dirName = parts[0];
      if (!dirName || dirName.startsWith(".")) return;

      // Debounce bursts of file-change events.
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await loader.reloadPlugin(dirName);
        refresh();
      }, 300);
    });
  }

  fs.watch(path.dirname(CONFIG_PATH), (_eventType, filename) => {
    if (filename !== "config.json") return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await loader.reloadAll();
      refresh();
    }, 300);
  });
}

async function main(): Promise<void> {
  const ctx = new Context();

  // 1. Register host services (they are Cordis plugins too).
  ctx.plugin(CommandService);
  ctx.plugin(MenuService);
  ctx.plugin(IpcService);

  // Host listens for plugin menu clicks that want to show a native dialog.
  ctx.on("ui/message", (payload: any) => {
    if (mainWindow) dialog.showMessageBox(mainWindow, payload);
  });

  // 2. Load plugins from the directory (await dynamic imports first).
  const loader = await createLoader(ctx, PLUGINS_DIR, () => readConfig());

  // 3. Generic IPC (handlers run later, once services are up).
  registerIpc(ctx, loader);

  // 4. Boot Cordis. The menu provider MUST be set AFTER ctx.start(), because
  //    Cordis only provides services (ctx.menu / ctx.commands / ctx.ipc) on start.
  await app.whenReady();
  await ctx.start();
  ctx.menu.setPluginMenuProvider(() => buildPluginMenu(ctx, loader));

  // 5. Create the window once plugin apply() has run.
  setTimeout(() => {
    createWindow(ctx);
    ctx.menu.rebuild();
    watch(ctx, loader);
  }, 150);
}

app.on("before-quit", () => {
  mainWindow = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

void main();
