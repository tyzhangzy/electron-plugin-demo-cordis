import { Context, Service } from "@cordisjs/core";

/**
 * host/services/command.ts
 *
 * CommandService - central command registry.
 * A plugin registers commands in its `apply(ctx)` via `ctx.commands.register(...)`.
 * The renderer / menu invoke them via `ctx.commands.invoke(id, params)`.
 */
export interface CommandMeta {
  id: string;
  title: string;
  description: string;
  plugin: string;
}

interface CommandEntry extends CommandMeta {
  handler: (params?: any) => any;
}

declare module "@cordisjs/core" {
  interface Context {
    commands: CommandService;
  }
}

export class CommandService extends Service {
  private entries = new Map<string, CommandEntry>();

  constructor(ctx: Context) {
    super(ctx, "commands");
  }

  register(opts: { plugin: string; id: string; title: string; description?: string; handler: (params?: any) => any }): void {
    if (!opts?.id || !opts.plugin || typeof opts.handler !== "function") {
      throw new Error("CommandService.register: invalid command (missing plugin/id/handler)");
    }
    const entry: CommandEntry = {
      id: opts.id,
      title: opts.title || opts.id,
      description: opts.description || "",
      plugin: opts.plugin,
      handler: opts.handler,
    };
    this.entries.set(opts.id, entry);
  }

  /** Remove every command registered by a plugin (used by the hot-reload loader). */
  clearByPlugin(plugin: string): void {
    for (const [id, e] of Array.from(this.entries)) {
      if (e.plugin === plugin) this.entries.delete(id);
    }
  }

  async invoke(id: string, params?: any): Promise<any> {
    const entry = this.entries.get(id);
    if (!entry) return { success: false, error: "Unknown command: " + id };
    try {
      const data = await entry.handler(params);
      return { success: true, plugin: entry.plugin, commandId: id, data };
    } catch (e: any) {
      return { success: false, plugin: entry.plugin, commandId: id, error: e?.message ?? String(e) };
    }
  }

  /** All commands (flat), grouped by plugin. */
  list(): CommandMeta[] {
    return Array.from(this.entries.values()).map(({ handler: _h, ...meta }) => meta);
  }

  listByPlugin(plugin: string): CommandMeta[] {
    return this.list().filter((c) => c.plugin === plugin);
  }
}
