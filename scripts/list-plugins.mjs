/**
 * scripts/list-plugins.mjs
 *
 * Headless CLI: list plugins and their status/commands (no Electron/GUI).
 * Run after `npm run build`.
 */
import { Context } from "@cordisjs/core";
import { CommandService } from "../dist/host/services/command.js";
import { createLoader } from "../dist/host/loader.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");
const pluginsDir = path.join(dist, "plugins");
const configPath = path.join(dist, "config.json");
const readConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));

const ctx = new Context();
ctx.plugin(CommandService);
const loader = await createLoader(ctx, pluginsDir, readConfig);
await ctx.start();
ctx.emit("ready");
await new Promise((r) => setTimeout(r, 500));

console.log("name\tloaded\tcommands\t\t\treason");
for (const p of loader.list()) {
  const cmds = p.commands.map((c) => c.id).join(", ");
  console.log(`${p.name}\t${p.loaded ? "Y" : "-"}\t${cmds || "(none)"}\t${p.reason || ""}`);
}

process.exit(0);
