"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("types-publisher/bin/util/util");
exports.config = {
    database: {
        benchmarksDatabaseId: 'benchmarks',
        packageBenchmarksContainerId: 'packageBenchmarks',
        packageBenchmarksDocumentSchemaVersion: 0,
        endpoint: 'https://dt-perf.documents.azure.com:443/',
        get writeKey() {
            return util_1.assertDefined(process.env.DATABASE_WRITE_KEY, `Required environment variable 'DATABASE_WRITE_KEY' was not set`);
        },
        get readKey() {
            return util_1.assertDefined(process.env.DATABASE_READ_KEY, `Required environment variable 'DATABASE_READ_KEY' was not set`);
        }
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvbW1vbi9jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSx3REFBOEQ7QUFFakQsUUFBQSxNQUFNLEdBQUc7SUFDcEIsUUFBUSxFQUFFO1FBQ1Isb0JBQW9CLEVBQUUsWUFBWTtRQUNsQyw0QkFBNEIsRUFBRSxtQkFBbUI7UUFDakQsc0NBQXNDLEVBQUUsQ0FBQztRQUN6QyxRQUFRLEVBQUUsMENBQTBDO1FBQ3BELElBQUksUUFBUTtZQUNWLE9BQU8sb0JBQWEsQ0FDbEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFDOUIsZ0VBQWdFLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQ0QsSUFBSSxPQUFPO1lBQ1QsT0FBTyxvQkFBYSxDQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUM3QiwrREFBK0QsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7S0FDRjtDQUNGLENBQUMifQ==