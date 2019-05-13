export declare const enum DatabaseAccessLevel {
    Read = "read",
    Write = "write"
}
export declare function getDatabase(accessLevel: DatabaseAccessLevel): Promise<{
    database: import("@azure/cosmos").Database;
    container: import("@azure/cosmos").Container;
}>;
