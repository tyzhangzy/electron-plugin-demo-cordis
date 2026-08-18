import { Context } from "@cordisjs/core";
import * as fs from "node:fs";
import * as path from "node:path";

const NAME = "version-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "version.app",
      title: "App Info",
      description: "Return the application name from package.json",
      handler: () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
        return pkg.name;
      },
    });
  },
};
