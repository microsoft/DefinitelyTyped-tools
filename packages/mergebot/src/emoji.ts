import { CIResult } from "./pr-info";

export const failed = (isFailed: boolean) => isFailed ? "❌" : "✅";

export const pending = (isPending: boolean) => isPending ? "🕐" : "✅";

export const result = (result: CIResult) => {
    switch (result) {
        case "fail": return { emoji: "❌", text: "have failed" };
        case "pass": return { emoji: "✅", text: "have passed" };
        case "action_required": return { emoji: "🔐", text: "waiting for a maintainer to authorize a run" };
        case "unknown": return { emoji: "🕐", text: "are still running" };
        case "missing": return { emoji: "❓", text: "have gone missing" };
    }
};
