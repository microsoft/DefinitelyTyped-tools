import { AllPackages } from 'types-publisher/bin/lib/packages';
import { FS } from 'types-publisher/bin/get-definitely-typed';
export declare function getParsedPackages(definitelyTypedPath: string): Promise<{
    definitelyTypedFS: FS;
    allPackages: AllPackages;
}>;
