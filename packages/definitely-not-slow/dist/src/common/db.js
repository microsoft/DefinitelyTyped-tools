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
const cosmos_1 = require("@azure/cosmos");
const config_1 = require("./config");
const util_1 = require("types-publisher/bin/util/util");
function getKey(accessLevel) {
    switch (accessLevel) {
        case "read" /* Read */:
            return config_1.config.database.readKey;
        case "write" /* Write */:
            return config_1.config.database.writeKey;
        default:
            util_1.assertNever(accessLevel);
    }
}
;
function getDatabase(accessLevel) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = new cosmos_1.CosmosClient({
            endpoint: config_1.config.database.endpoint,
            key: getKey(accessLevel),
        });
        const { database } = yield client.databases.createIfNotExists({
            id: config_1.config.database.benchmarksDatabaseId,
        });
        const { container } = yield database.containers.createIfNotExists({
            id: config_1.config.database.packageBenchmarksContainerId,
            partitionKey: {
                kind: 'Hash',
                paths: ['/body/packageName']
            }
        });
        return { database, container };
    });
}
exports.getDatabase = getDatabase;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29tbW9uL2RiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwwQ0FBNkM7QUFDN0MscUNBQWtDO0FBQ2xDLHdEQUE0RDtBQU81RCxTQUFTLE1BQU0sQ0FBQyxXQUFnQztJQUM5QyxRQUFRLFdBQVcsRUFBRTtRQUNuQjtZQUNFLE9BQU8sZUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7UUFDakM7WUFDRSxPQUFPLGVBQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO1FBQ2xDO1lBQ0Usa0JBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztLQUM1QjtBQUNILENBQUM7QUFBQSxDQUFDO0FBRUYsU0FBc0IsV0FBVyxDQUFDLFdBQWdDOztRQUNoRSxNQUFNLE1BQU0sR0FBRyxJQUFJLHFCQUFZLENBQUM7WUFDOUIsUUFBUSxFQUFFLGVBQU0sQ0FBQyxRQUFRLENBQUMsUUFBUTtZQUNsQyxHQUFHLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQztTQUN6QixDQUFDLENBQUM7UUFFSCxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxNQUFNLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDO1lBQzVELEVBQUUsRUFBRSxlQUFNLENBQUMsUUFBUSxDQUFDLG9CQUFvQjtTQUN6QyxDQUFDLENBQUM7UUFFSCxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsTUFBTSxRQUFRLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDO1lBQ2hFLEVBQUUsRUFBRSxlQUFNLENBQUMsUUFBUSxDQUFDLDRCQUE0QjtZQUNoRCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLE1BQU07Z0JBQ1osS0FBSyxFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDN0I7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxDQUFDO0lBQ2pDLENBQUM7Q0FBQTtBQW5CRCxrQ0FtQkMifQ==