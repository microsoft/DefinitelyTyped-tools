"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
function createDocument(body, version) {
    return {
        version,
        createdAt: new Date(),
        system: {
            cpus: os.cpus().map((_a) => {
                var { times } = _a, cpu = __rest(_a, ["times"]);
                return cpu;
            }),
            arch: os.arch(),
            platform: os.platform(),
            release: os.release(),
            totalmem: os.totalmem(),
        },
        body,
    };
}
function insertPackageBenchmark(benchmark, version, container) {
    return __awaiter(this, void 0, void 0, function* () {
        return container.items.create(createDocument(benchmark, version));
    });
}
exports.insertPackageBenchmark = insertPackageBenchmark;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvd3JpdGUvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFJekIsU0FBUyxjQUFjLENBQUksSUFBTyxFQUFFLE9BQWU7SUFDakQsT0FBTztRQUNMLE9BQU87UUFDUCxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUU7UUFDckIsTUFBTSxFQUFFO1lBQ04sSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFpQixFQUFFLEVBQUU7b0JBQXJCLEVBQUUsS0FBSyxPQUFVLEVBQVIsMkJBQU07Z0JBQU8sT0FBQSxHQUFHLENBQUE7YUFBQSxDQUFDO1lBQy9DLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFO1lBQ2YsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUU7WUFDdkIsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUU7WUFDckIsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUU7U0FDeEI7UUFDRCxJQUFJO0tBQ0wsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFzQixzQkFBc0IsQ0FBQyxTQUFrQyxFQUFFLE9BQWUsRUFBRSxTQUFvQjs7UUFDcEgsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDcEUsQ0FBQztDQUFBO0FBRkQsd0RBRUMifQ==