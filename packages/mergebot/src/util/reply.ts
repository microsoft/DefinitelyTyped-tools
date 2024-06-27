import { InvocationContext } from "@azure/functions";

export const reply = (context: InvocationContext, status: number, body: string) => {
    context.info(`${body} [${status}]`);
    return { status, body };
};
