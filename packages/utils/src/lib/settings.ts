import { joinPaths } from "../fs";
const root = joinPaths(__dirname, "..", "..");
export const logDir = joinPaths(root, "logs");
