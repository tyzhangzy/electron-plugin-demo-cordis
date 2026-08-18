import { Context } from "@cordisjs/core";

/**
 * hello-plugin - demonstrates, in Cordis form:
 *   1. ctx.commands.register   (invokable from the renderer)
 *   2. ctx.menu.registerMenu   (native menu; fires a host event via ctx.emit)
 *   3. ctx.ipc.handle          (custom IPC channel)
 */
const NAME = "hello-plugin";

export default {
  name: NAME,
  inject: ["commands", "menu", "ipc"],
  apply(ctx: Context) {
    console.log("[hello-plugin] activate() called");

    ctx.commands.register({
      plugin: NAME,
      id: "hello.greet",
      title: "Greet",
      description: "Return a greeting message (optional name parameter)",
      handler: (params: any) => {
        const who = (params && (params.name || params.from)) || "friend";
        return { message: `Hello, ${who}! A greeting from hello-plugin.`, time: new Date().toLocaleString() };
      },
    });

    ctx.menu.registerMenu(
      "Hello",
      [
        {
          label: "hello-plugin: Popup Greeting",
          click: () =>
            ctx.emit("ui/message", {
              type: "info",
              title: "hello-plugin",
              message: "This is a native dialog triggered from the system menu.",
            }),
        },
      ],
      NAME,
    );

    ctx.ipc.handle(NAME, "hello:ping", () => "pong");
  },
};
