type FindingLevel = 'warn' | 'fail';
export type ProductionSafetyFinding = {
    level: FindingLevel;
    code: string;
    message: string;
};
export declare function getProductionSafetyFindings(env?: NodeJS.ProcessEnv): ProductionSafetyFinding[];
export declare function assertProductionSafety(env?: NodeJS.ProcessEnv): void;
export {};
