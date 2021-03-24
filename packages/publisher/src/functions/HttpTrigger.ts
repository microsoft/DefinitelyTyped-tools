import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { existsSync, mkdirp } from "fs-extra";

const httpTrigger: AzureFunction = async function (context: Context): Promise<void> {
    context.log('HTTP trigger function processed a request.');

    context.log("existsSync", existsSync("/storage"));
    context.log("mkdirp");
    await mkdirp("/storage/DefinitelyTyped");
    context.log("existsSync (subfolder)", existsSync("/storage/DefinitelyTyped"));
};

export default httpTrigger;
