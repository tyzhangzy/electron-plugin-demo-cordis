import { Context } from "@cordisjs/core";

const NAME = "env-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "env.info",
      title: "Environment Info",
      description: "Return platform, Node version and current directory",
      handler: () => ({ platform: process.platform, node: process.version, cwd: process.cwd() }),
    });
  },
};
