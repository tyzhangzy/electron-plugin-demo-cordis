import { Context } from "@cordisjs/core";

/**
 * event-subscriber-plugin - subscribes to events on the Cordis event bus.
 * ctx.on(...) is auto-removed when this plugin is disposed (lifecycle cleanup).
 */
const NAME = "event-subscriber-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    let lastMessage: any = null;

    ctx.on("demo:message", (payload: any) => {
      lastMessage = payload;
      console.log("[event-subscriber-plugin] received event:", payload);
    });

    ctx.commands.register({
      plugin: NAME,
      id: "bus.last-message",
      title: "Last Bus Message",
      description: "Return the last message received from the event bus",
      handler: () => lastMessage || { message: "No message received yet" },
    });
  },
};
