import { Context } from "@cordisjs/core";

/**
 * sample-disabled-plugin - demonstrates a disabled plugin.
 *
 * Central config.json sets it disabled, so its entry is never loaded and this
 * command is never registered.
 */
const NAME = "sample-disabled-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "disabled.demo",
      title: "Should Not Appear",
      description: "This command is never registered because the plugin is disabled",
      handler: () => "never",
    });
  },
};
