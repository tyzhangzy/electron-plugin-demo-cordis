import { Context } from "@cordisjs/core";

const NAME = "text-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "text.count",
      title: "Character Count",
      description: "Count the characters of the passed text",
      handler: (params: any) => String((params && params.text) || "").length,
    });
  },
};
