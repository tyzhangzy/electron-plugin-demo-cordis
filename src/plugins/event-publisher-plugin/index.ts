import { Context } from "@cordisjs/core";

/**
 * event-publisher-plugin - publishes events to the shared Cordis event bus.
 * (Previously a hand-written EventEmitter; now ctx.emit on the Cordis bus.)
 */
const NAME = "event-publisher-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "bus.publish",
      title: "Publish Event",
      description: "Publish a demo event to the inter-plugin bus",
      handler: (params: any) => {
        const message = (params && params.message) || "hello from event-publisher-plugin";
        ctx.emit("demo:message", { text: message, timestamp: Date.now() });
        return { published: true, event: "demo:message", message };
      },
    });
  },
};
