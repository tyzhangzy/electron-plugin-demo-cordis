import { Context, Service } from "@cordisjs/core";
import { ipcMain } from "electron";

/**
 * host/services/ipc.ts
 *
 * IpcService - thin wrapper over Electron ipcMain / webContents.
 * Plugins use `ctx.ipc.handle(channel, fn)` to expose a custom IPC channel and
 * `ctx.ipc.send(channel, data)` to push a message to the renderer.
 */
declare module "@cordisjs/core" {
  interface Context {
    ipc: IpcService;
  }
}

export class IpcService extends Service {
  private handled = new Map<string, string>(); // channel -> plugin
  private window: { webContents: { send(channel: string, data: any): void; isDestroyed(): boolean } } | null = null;

  constructor(ctx: Context) {
    super(ctx, "ipc");
  }

  /** Called by the electron host plugin once the BrowserWindow is created. */
  setWindow(win: any): void {
    this.window = win;
  }

  handle(plugin: string, channel: string, fn: (event: any, ...args: any[]) => any): void {
    ipcMain.handle(channel, async (event: any, ...args: any[]) => fn(event, ...args));
    this.handled.set(channel, plugin);
  }

  remove(channel: string): void {
    try { ipcMain.removeHandler(channel); } catch { /* noop */ }
    this.handled.delete(channel);
  }

  /** Remove every handler a plugin registered (used by the hot-reload loader). */
  clearByPlugin(plugin: string): void {
    for (const [ch, plg] of Array.from(this.handled)) {
      if (plg === plugin) this.remove(ch);
    }
  }

  send(channel: string, data: any): void {
    if (this.window && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  /** Remove every handler registered through this service (host teardown). */
  cleanup(): void {
    for (const ch of Array.from(this.handled.keys())) this.remove(ch);
  }
}
