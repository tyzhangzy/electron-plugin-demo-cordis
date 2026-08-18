import { Context } from "@cordisjs/core";

/**
 * math-plugin - commands that accept parameters & throw errors.
 * When a handler throws, CommandService.invoke wraps it as { success:false, error }.
 */
const NAME = "math-plugin";

export default {
  name: NAME,
  inject: ["commands", "menu"],
  apply(ctx: Context) {
    console.log("[math-plugin] activate() called");

    ctx.commands.register({
      plugin: NAME,
      id: "math.add",
      title: "Add (a + b)",
      description: "Pass {a, b}, returns the sum (default a=2, b=3)",
      handler: (params: any) => {
        const a = Number((params && params.a) !== undefined ? params.a : 2);
        const b = Number((params && params.b) !== undefined ? params.b : 3);
        if (isNaN(a) || isNaN(b)) throw new Error("Parameters a and b must be numbers");
        return { expression: a + " + " + b, result: a + b };
      },
    });

    ctx.commands.register({
      plugin: NAME,
      id: "math.divide",
      title: "Divide (a / b)",
      description: "Pass {a, b}, returns the quotient (default a=10, b=0 to demo an error)",
      handler: (params: any) => {
        const a = Number((params && params.a) !== undefined ? params.a : 10);
        const b = Number((params && params.b) !== undefined ? params.b : 0);
        if (isNaN(a) || isNaN(b)) throw new Error("Parameters a and b must be numbers");
        if (b === 0) throw new Error("Cannot divide by zero");
        return { expression: a + " / " + b, result: a / b };
      },
    });

    ctx.menu.registerMenu(
      "Math",
      [
        {
          label: "Example: 3 + 5 (popup)",
          click: () => ctx.emit("ui/message", { type: "info", title: "math-plugin", message: "3 + 5 = " + (3 + 5) }),
        },
      ],
      NAME,
    );
  },
};
