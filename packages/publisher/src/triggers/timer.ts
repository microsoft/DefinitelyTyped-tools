import { Context } from "@azure/functions";
import main from "../main";

export default async function timerTrigger(context: Context) {
  context.log("Running via timer trigger");
  return main();
}
