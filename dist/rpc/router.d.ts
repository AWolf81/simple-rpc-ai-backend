/**
 * Type-safe RPC Router inspired by tRPC patterns
 *
 * Provides createRPCRouter for building type-safe JSON-RPC endpoints
 * with automatic OpenRPC schema generation.
 */
import type { Request, Response } from 'express';
export interface RPCContext {
    req: Request;
    res: Response;
}
export interface RPCMeta {
    description?: string;
    examples?: Array<{
        name: string;
        params?: any;
        result?: any;
    }>;
}
export interface RPCProcedure<TInput = any, TOutput = any> {
    _def: {
        input?: (input: unknown) => TInput;
        output?: (output: TOutput) => TOutput;
        meta?: RPCMeta;
        resolver: (input: TInput, ctx: RPCContext) => Promise<TOutput> | TOutput;
    };
}
export interface RPCProcedureBuilder {
    input<T>(validator: (input: unknown) => T): RPCProcedureWithInput<T>;
    meta(meta: RPCMeta): this;
    mutation<TOutput>(resolver: (input: unknown, ctx: RPCContext) => Promise<TOutput> | TOutput): RPCProcedure<unknown, TOutput>;
    query<TOutput>(resolver: (input: unknown, ctx: RPCContext) => Promise<TOutput> | TOutput): RPCProcedure<unknown, TOutput>;
}
export interface RPCProcedureWithInput<TInput> {
    meta(meta: RPCMeta): this;
    mutation<TOutput>(resolver: (input: TInput, ctx: RPCContext) => Promise<TOutput> | TOutput): RPCProcedure<TInput, TOutput>;
    query<TOutput>(resolver: (input: TInput, ctx: RPCContext) => Promise<TOutput> | TOutput): RPCProcedure<TInput, TOutput>;
}
export interface RPCRouter {
    _def: {
        procedures: Record<string, RPCProcedure>;
    };
}
export type InputValidator<T> = (input: unknown) => T;
export declare const v: {
    object: <T extends Record<string, any>>(schema: { [K in keyof T]: InputValidator<T[K]>; }) => InputValidator<T>;
    string: () => InputValidator<string>;
    number: () => InputValidator<number>;
    optional: <T>(validator: InputValidator<T>) => InputValidator<T | undefined>;
};
declare class RPCProcedureBuilderImpl implements RPCProcedureBuilder, RPCProcedureWithInput<any> {
    private _input?;
    private _meta?;
    input<T>(validator: (input: unknown) => T): RPCProcedureWithInput<T>;
    meta(meta: RPCMeta): this;
    mutation<TOutput>(resolver: (input: any, ctx: RPCContext) => Promise<TOutput> | TOutput): RPCProcedure<any, TOutput>;
    query<TOutput>(resolver: (input: any, ctx: RPCContext) => Promise<TOutput> | TOutput): RPCProcedure<any, TOutput>;
}
export declare const publicProcedure: RPCProcedureBuilderImpl;
export declare function createRPCRouter(procedures: Record<string, RPCProcedure>): RPCRouter;
export declare function executeProcedure(procedure: RPCProcedure, input: unknown, ctx: RPCContext): Promise<any>;
export declare function generateOpenRPCSchema(router: RPCRouter, info: {
    title: string;
    description?: string;
    version: string;
}): any;
export {};
//# sourceMappingURL=router.d.ts.map