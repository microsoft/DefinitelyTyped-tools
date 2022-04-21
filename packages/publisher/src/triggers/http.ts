import { AzureFunction, Context } from "@azure/functions";
import main from "../main";

const httpTrigger: AzureFunction = async function (context: Context): Promise<void> {
  context.log("HTTP trigger function processed a request.");
  const triggerResult = await main();
  if (!triggerResult.triggered) {
    context.log(`Skipping run; previous run from ${triggerResult.timestamp} is still active.`);
  }
};

export default httpTrigger;
