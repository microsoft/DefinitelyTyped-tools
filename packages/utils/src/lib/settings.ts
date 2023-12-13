import { joinPaths } from "../fs";
const root = joinPaths(__dirname, "..", "..");
const storageDirPath = process.env.STORAGE_DIR || root;
export const logDir = joinPaths(storageDirPath, "logs");
