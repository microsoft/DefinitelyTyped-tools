import { Context } from "@azure/functions";
import main from "../main";

export default async function timerTrigger(context: Context) {
  context.log("Running via timer trigger");
  const triggerResult = await main();
  if (!triggerResult.triggered) {
    context.log(`Skipping run; previous run from ${triggerResult.timestamp} is still active.`);
  }
}
