interface BwrapOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    writablePaths?: Iterable<string>;
    readOnlyPaths?: Iterable<string>;
    allowNetwork?: boolean;
}
export declare function wrapCommandWithBwrap(command: string, args: string[], options?: BwrapOptions): {
    command: string;
    args: string[];
};
export {};
