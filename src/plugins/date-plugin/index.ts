import { Context } from "@cordisjs/core";

const NAME = "date-plugin";

export default {
  name: NAME,
  inject: ["commands"],
  apply(ctx: Context) {
    ctx.commands.register({
      plugin: NAME,
      id: "date.today",
      title: "Today's Date",
      description: "Return today as year-month-day",
      handler: () => new Date().toLocaleDateString("en-CA"),
    });
    ctx.commands.register({
      plugin: NAME,
      id: "date.weekday",
      title: "Day of Week",
      description: "Return what day of the week it is",
      handler: () => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()],
    });
  },
};
