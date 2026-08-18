import type { CommandService } from "./services/command.js";
import type { MenuService } from "./services/menu.js";
import type { IpcService } from "./services/ipc.js";

/**
 * host/types.ts - module augmentation so `ctx.commands`, `ctx.menu`, `ctx.ipc`
 * are typed after the services are registered.
 */
declare module "@cordisjs/core" {
  interface Context {
    commands: CommandService;
    menu: MenuService;
    ipc: IpcService;
  }

  interface Events {
    /** Plugin menu clicks that want to show a native dialog (handled by the host). */
    "ui/message"(payload: { type?: string; title: string; message: string }): void;
    /** Inter-plugin event published by event-publisher-plugin. */
    "demo:message"(payload: { text: string; timestamp: number }): void;
  }
}

/** A plugin manifest, read from plugin.json (superset of Cordis plugin options). */
export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  main?: string;
  enabled?: boolean;
  /** functions this plugin provides (used to count total functions). */
  functions?: string[];
  /** services this plugin depends on (Cordis inject). */
  inject?: string[];
}

/** Plugin metadata known to the loader, surfaced to the renderer. */
export interface PluginMeta {
  name: string;
  version: string;
  description: string;
  functions: string[];
  /** true if the plugin actually loaded (registered >=1 command). */
  loaded: boolean;
  /** non-empty when the plugin was skipped. */
  reason: string;
}
