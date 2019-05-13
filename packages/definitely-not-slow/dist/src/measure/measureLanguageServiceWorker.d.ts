import { Omit, LanguageServiceSingleMeasurement } from '../common';
export declare const measureLanguageServiceWorkerFilename: string;
export interface MeasureLanguageServiceArgs extends Omit<LanguageServiceSingleMeasurement, 'quickInfoDuration' | 'completionsDuration'> {
    packageDirectory: string;
}
export interface MeasureLanguageServiceChildProcessArgs extends MeasureLanguageServiceArgs {
    tsPath: string;
    [key: string]: any;
}
