/**
 * scripts/toggle-plugin.mjs
 *
 * Headless CLI: toggle a plugin in dist/config.json and verify the loader
 * picks it up (demonstrates config.json hot-reload with dynamic config reads).
 *
 * Usage: node scripts/toggle-plugin.mjs <pluginName> <true|false>
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

const [name, enabledStr] = process.argv.slice(2);
if (!name || !["true", "false"].includes(enabledStr ?? "")) {
  console.error("usage: node scripts/toggle-plugin.mjs <pluginName> <true|false>");
  process.exit(1);
}
const enabled = enabledStr === "true";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.plugins = config.plugins || {};
config.plugins[name] = { enabled };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`[toggle] wrote config.plugins["${name}"].enabled = ${enabled}`);

// Reload with a fresh dynamic config reader and verify the change took effect.
const readConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));
const ctx = new Context();
ctx.plugin(CommandService);
const loader = await createLoader(ctx, pluginsDir, readConfig);
await ctx.start();
ctx.emit("ready");
await new Promise((r) => setTimeout(r, 400));

const rec = loader.records().find((p) => p.name === name);
console.log(
  `${name} -> enabled=${enabled}, loaded=${rec ? rec.reason === "" : false}, reason="${rec?.reason ?? "unknown"}"`
);

process.exit(0);
