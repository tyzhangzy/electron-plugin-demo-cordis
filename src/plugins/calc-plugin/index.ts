import { Context } from "@cordisjs/core";

const NAME = "calc-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "calc.percent",
      title: "Percentage (a is ?% of b)",
      description: "Pass {a, b}, returns the percentage (default a=15, b=60)",
      handler: (params: any) => {
        const a = Number((params && params.a) !== undefined ? params.a : 15);
        const b = Number((params && params.b) !== undefined ? params.b : 60);
        return Math.round((a / b) * 100) + "%";
      },
    });
  },
};
