import { Context } from "@cordisjs/core";

const NAME = "random-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "random.number",
      title: "Random Number (0-100)",
      description: "Return a random integer from 0 to 100",
      handler: () => Math.floor(Math.random() * 101),
    });
  },
};
