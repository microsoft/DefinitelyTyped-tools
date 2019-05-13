"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const benchmark_1 = require("./benchmark");
const getPackagesToBenchmark_1 = require("./getPackagesToBenchmark");
const entry = process.argv[2];
const args = common_1.deserializeArgs(process.argv.slice(3));
(() => __awaiter(this, void 0, void 0, function* () {
    try {
        switch (entry) {
            case 'benchmark':
                return benchmark_1.benchmark(args);
            case 'getPackagesToBenchmark':
                return getPackagesToBenchmark_1.getPackagesToBenchmark(args);
            default:
                console.error(`Unrecognized entry '${entry}'`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}))();
process.on('unhandledRejection', err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY2xpL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxzQ0FBNEM7QUFDNUMsMkNBQXdDO0FBQ3hDLHFFQUFrRTtBQUdsRSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLE1BQU0sSUFBSSxHQUFHLHdCQUFlLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRCxDQUFDLEdBQVMsRUFBRTtJQUNWLElBQUk7UUFDRixRQUFRLEtBQUssRUFBRTtZQUNiLEtBQUssV0FBVztnQkFDZCxPQUFPLHFCQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDekIsS0FBSyx3QkFBd0I7Z0JBQzNCLE9BQU8sK0NBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEM7Z0JBQ0UsT0FBTyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsS0FBSyxHQUFHLENBQUMsQ0FBQztTQUNsRDtLQUNGO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDakI7QUFDSCxDQUFDLENBQUEsQ0FBQyxFQUFFLENBQUM7QUFFTCxPQUFPLENBQUMsRUFBRSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsQ0FBQyxFQUFFO0lBQ3JDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbkIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQixDQUFDLENBQUMsQ0FBQyJ9