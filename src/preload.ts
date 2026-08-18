import { contextBridge, ipcRenderer } from "electron";

/**
 * preload.ts - safe bridge (same contract as the original demo).
 * Renderer (nodeIntegration=false, contextIsolation=true) can only call
 * window.plugins methods exposed here.
 */
contextBridge.exposeInMainWorld("plugins", {
  /** Get the plugin list (including each plugin's registered commands). */
  list: () => ipcRenderer.invoke("plugin:list"),
  /** Invoke a command of a plugin. */
  invoke: (commandId: string, params?: any) => ipcRenderer.invoke("plugin:invoke", { commandId, params }),
  /** Subscribe to main-process push messages. */
  on: (channel: string, callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  /** Send renderer logs/errors to the main process (diagnostics). */
  log: (...args: any[]) => ipcRenderer.send("renderer:log", ...args),
});
