import { AzureFunction, Context } from "@azure/functions";
import main from "../main";

const httpTrigger: AzureFunction = async function (context: Context): Promise<void> {
  context.log('HTTP trigger function processed a request.');
  context.res = await main();
};

export default httpTrigger;
