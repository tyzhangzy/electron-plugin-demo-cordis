import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { Context } from "@cordisjs/core";

/**
 * host/loader.ts
 *
 * The ONLY hand-written bridge Cordis does not provide natively: it scans a
 * plugins directory, reads each plugin.json, respects the central config.json
 * switch, dynamically imports the entry and wraps it as a Cordis plugin
 * ({ name, inject, apply }), keeping the returned ForkScope for hot-reload.
 *
 * Everything else (DI via inject[], lifecycle, cleanup via ctx.effect, events)
 * is handled by Cordis itself.
 */

export interface PluginRecord {
  name: string;
  version: string;
  description: string;
  functions: string[];
  reason: string; // non-empty when skipped
}

export interface PluginListItem {
  name: string;
  version: string;
  loaded: boolean;
  reason: string;
  description: string;
  functions: string[];
  commands: { id: string; title: string; description: string }[];
}

export interface PluginLoader {
  records(): PluginRecord[];
  list(): PluginListItem[];
  reloadPlugin(name: string): Promise<void>;
  reloadAll(): Promise<void>;
}

/** Build a loader that discovers plugins under `dir` and registers them on `ctx`. */
export async function createLoader(ctx: Context, dir: string, getConfig: () => any): Promise<PluginLoader> {
  const meta = new Map<string, PluginRecord & { fiber: any }>();

  async function loadOne(dirName: string): Promise<void> {
    const pluginDir = path.join(dir, dirName);
    const manifestPath = path.join(pluginDir, "plugin.json");
    if (!fs.existsSync(manifestPath)) return;

    let manifest: any;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      console.log(`[loader] failed to parse manifest: ${dirName}`);
      return;
    }

    const name = manifest.name || dirName;
    const version = manifest.version || "0.0.0";
    const description = manifest.description || "";
    const functions = Array.isArray(manifest.functions) ? manifest.functions : [];
    const base = { name, version, description, functions };

    // Central config.json overrides the plugin's own enabled field.
    // Read fresh each load so config.json hot-reload takes effect.
    const config = getConfig();
    const central = config?.plugins?.[name];
    const enabled = typeof central?.enabled === "boolean" ? central.enabled : manifest.enabled !== false;
    if (!enabled) {
      meta.set(name, { ...base, reason: "disabled", fiber: null });
      console.log(`[loader] skip "${name}": disabled`);
      return;
    }

    const entryFile = manifest.main || "index.js";
    const entryPath = path.join(pluginDir, entryFile);
    if (!fs.existsSync(entryPath)) {
      meta.set(name, { ...base, reason: `missing entry ${entryFile}`, fiber: null });
      return;
    }

    let mod: any;
    try {
      // ?t= busts ESM import cache so hot-reload can re-import the same file.
      mod = await import(pathToFileURL(entryPath).href + "?t=" + Date.now());
    } catch (e: any) {
      meta.set(name, { ...base, reason: `load error: ${e?.message ?? e}`, fiber: null });
      console.log(`[loader] failed to load "${name}": ${e?.message ?? e}`);
      return;
    }

    let pluginDef: any;
    const entry = mod?.default;
    if (typeof entry === "function") {
      pluginDef = { name, inject: Array.isArray(manifest.inject) ? manifest.inject : [], apply: entry };
    } else if (entry && typeof entry.apply === "function") {
      pluginDef = {
        name: entry.name || name,
        inject: entry.inject ?? (Array.isArray(manifest.inject) ? manifest.inject : []),
        apply: entry.apply,
      };
    } else {
      meta.set(name, { ...base, reason: "entry has no usable apply", fiber: null });
      return;
    }

    const fiber = ctx.plugin(pluginDef);
    meta.set(name, { ...base, reason: "", fiber });
    console.log(`[loader] registered "${name}"@${version}`);
  }

  async function loadAll(): Promise<void> {
    meta.clear();
    if (!fs.existsSync(dir)) return;
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
    for (const name of entries) await loadOne(name);
  }

  /** Dispose one plugin: stop its fiber and clear its side effects in the services. */
  async function unloadOne(name: string): Promise<void> {
    const rec = meta.get(name);
    if (!rec) return;
    if (rec.fiber) {
      await rec.fiber.dispose();
      ctx.commands.clearByPlugin(name);
      // menu / ipc services may be absent in headless contexts (need Electron).
      (ctx as any).menu?.clearByPlugin?.(name);
      (ctx as any).ipc?.clearByPlugin?.(name);
    }
    meta.delete(name);
  }

  await loadAll();

  return {
    records: () => Array.from(meta.values()).map(({ fiber: _f, ...r }) => r),
    list: () =>
      Array.from(meta.values()).map((r) => ({
        name: r.name,
        version: r.version,
        description: r.description,
        functions: r.functions,
        loaded: r.reason === "" && ctx.commands.listByPlugin(r.name).length > 0,
        reason: r.reason,
        commands: ctx.commands.listByPlugin(r.name).map((c) => ({ id: c.id, title: c.title, description: c.description })),
      })),
    async reloadPlugin(name) {
      await unloadOne(name);
      await loadOne(name);
    },
    async reloadAll() {
      for (const name of Array.from(meta.keys())) await unloadOne(name);
      await loadAll();
    },
  };
}
