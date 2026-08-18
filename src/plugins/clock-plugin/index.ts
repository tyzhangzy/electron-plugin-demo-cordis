import { Context } from "@cordisjs/core";

/**
 * clock-plugin - multiple commands + a submenu whose item pushes a message to
 * the renderer via ctx.ipc.send (main -> renderer), handled by preload/renderer.
 */
const NAME = "clock-plugin";

function formatNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
    " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
  );
}

export default {
  name: NAME,
  inject: ["commands", "menu", "ipc"],
  apply(ctx: Context) {
    console.log("[clock-plugin] activate() called");

    ctx.commands.register({
      plugin: NAME,
      id: "clock.now",
      title: "Current Time",
      description: "Return current system time (ISO / local / timestamp)",
      handler: () => ({ iso: new Date().toISOString(), local: new Date().toLocaleString(), unix: Date.now() }),
    });

    ctx.commands.register({
      plugin: NAME,
      id: "clock.formatted",
      title: "Formatted Time",
      description: "Return current time as yyyy-MM-dd HH:mm:ss",
      handler: () => ({ formatted: formatNow() }),
    });

    ctx.menu.registerMenu(
      "Clock",
      [
        {
          label: "Show Current Time (popup + push to renderer)",
          click: () => {
            const now = formatNow();
            ctx.emit("ui/message", { type: "info", title: "clock-plugin", message: "Current time: " + now });
            ctx.ipc.send("clock:menu", { now, from: NAME });
          },
        },
      ],
      NAME,
    );
  },
};
