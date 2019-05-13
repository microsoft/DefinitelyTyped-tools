import { AllPackages, PackageId } from 'types-publisher/bin/lib/packages';
export declare function installDependencies(allPackages: AllPackages, packageId: PackageId, typesPath: string): Promise<void>;
