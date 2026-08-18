import { Context } from "@cordisjs/core";

/**
 * report-plugin - demonstrates cross-plugin command invocation.
 *
 * It calls commands provided by other plugins via ctx.commands.invoke and
 * combines the results. (In the original demo this needed a hand-written
 * dependency resolver + invokeCommand; here the command service does it.)
 */
const NAME = "report-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    console.log("[report-plugin] activate() called; cross-plugin invocation via ctx.commands");

    ctx.commands.register({
      plugin: NAME,
      id: "report.aggregate",
      title: "Aggregate Report",
      description: "Call math.add and hello.greet, then combine results",
      handler: async (params: any) => {
        const addResult = await ctx.commands.invoke("math.add", { a: 10, b: 20 });
        const greetResult = await ctx.commands.invoke("hello.greet", { name: "Report" });
        return {
          from: NAME,
          params,
          addResult: addResult.success ? addResult.data : { error: addResult.error },
          greetResult: greetResult.success ? greetResult.data : { error: greetResult.error },
        };
      },
    });
  },
};
