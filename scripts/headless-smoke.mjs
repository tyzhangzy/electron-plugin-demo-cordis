/**
 * scripts/headless-smoke.mjs
 *
 * Headless smoke test: verifies the Cordis host core WITHOUT Electron/GUI.
 *  - creates a Context, registers the CommandService
 *  - loads plugins from dist/plugins via the directory loader
 *  - starts Cordis (await ctx.start(); emit "ready") and invokes commands
 *
 * Plugins that declare `inject: ["menu", "ipc"]` (hello/clock/math) stay PENDING
 * here because those services need Electron — this is expected. Command-only
 * plugins (date/note/etc.) must register and respond.
 */
import { Context } from "@cordisjs/core";
import { CommandService } from "../dist/host/services/command.js";
import { createLoader } from "../dist/host/loader.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.join(__dirname, "..", "dist", "plugins");

console.log("pluginsDir:", pluginsDir, "| exists:", fs.existsSync(pluginsDir));
if (fs.existsSync(pluginsDir)) {
  console.log("subdirs:", fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).join(","));
}

const ctx = new Context();
ctx.plugin(CommandService);

const loader = await createLoader(ctx, pluginsDir, () => ({ plugins: {} })).catch((e) => {
  console.log("createLoader ERROR:", e);
  throw e;
});
await ctx.start();
ctx.emit("ready");

// Let Cordis resolve injection and run plugin apply() (async).
await new Promise((r) => setTimeout(r, 600));

const day = await ctx.commands.invoke("date.today");
const upper = await ctx.commands.invoke("note.upper", { text: "cordis smoke" });
const list = loader.list();

console.log("date.today =>", JSON.stringify(day));
console.log("note.upper =>", JSON.stringify(upper));
console.log("plugin records:", loader.records().length, "| loaded:", list.filter((p) => p.loaded).map((p) => p.name).join(", "));

// ---- hot-reload check: dispose + re-register date-plugin, then invoke again ----
await loader.reloadPlugin("date-plugin");
await new Promise((r) => setTimeout(r, 400));
const day2 = await ctx.commands.invoke("date.today");
console.log("after reloadPlugin date-plugin =>", JSON.stringify(day2));
console.log("loaded after reload:", loader.list().filter((p) => p.loaded).map((p) => p.name).join(", "));

process.exit(day.success && upper.success && day2.success ? 0 : 1);
