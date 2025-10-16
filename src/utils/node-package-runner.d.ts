export type NodePackageRunner = {
    command: string;
    args: string[];
    runner: 'npx' | 'npm-exec';
};
export declare function resolveNodePackageRunner(preferred?: 'npx' | 'npm-exec'): NodePackageRunner;
//# sourceMappingURL=node-package-runner.d.ts.map