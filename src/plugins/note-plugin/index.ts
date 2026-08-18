import { Context } from "@cordisjs/core";

const NAME = "note-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "note.upper",
      title: "Uppercase",
      description: "Convert the passed text to uppercase (default: hello plugin)",
      handler: (params: any) => String((params && params.text) || "hello plugin").toUpperCase(),
    });
    ctx.commands.register({
      plugin: NAME,
      id: "note.reverse",
      title: "Reverse String",
      description: "Reverse the passed text",
      handler: (params: any) => String((params && params.text) || "abc").split("").reverse().join(""),
    });
  },
};
