/**
 * Simplified RPC Router using tRPC
 *
 * This file now exports tRPC components directly, simplifying the codebase
 * by using the battle-tested tRPC library instead of custom implementations.
 */
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc/index.js';
import { appRouter } from '../trpc/root.js';
import type { AppRouter } from '../trpc/root.js';
export { createTRPCRouter, publicProcedure };
export { appRouter as mainRouter };
export type { AppRouter };
export declare const v: {
    object: <Shape extends z.ZodRawShape>(shape: Shape, params?: z.RawCreateParams) => z.ZodObject<Shape, "strip", z.ZodTypeAny, z.objectOutputType<Shape, z.ZodTypeAny, "strip">, z.objectInputType<Shape, z.ZodTypeAny, "strip">>;
    string: (params?: z.RawCreateParams & {
        coerce?: true;
    }) => z.ZodString;
    number: (params?: z.RawCreateParams & {
        coerce?: boolean;
    }) => z.ZodNumber;
    optional: <Inner extends z.ZodTypeAny>(type: Inner, params?: z.RawCreateParams) => z.ZodOptional<Inner>;
    array: <El extends z.ZodTypeAny>(schema: El, params?: z.RawCreateParams) => z.ZodArray<El>;
    boolean: (params?: z.RawCreateParams & {
        coerce?: boolean;
    }) => z.ZodBoolean;
    enum: {
        <U extends string, T extends Readonly<[U, ...U[]]>>(values: T, params?: z.RawCreateParams): z.ZodEnum<z.Writeable<T>>;
        <U extends string, T extends [U, ...U[]]>(values: T, params?: z.RawCreateParams): z.ZodEnum<T>;
    };
};
export declare const createRPCRouter: typeof createTRPCRouter;
export declare function generateOpenRPCSchema(info: {
    title: string;
    description?: string;
    version: string;
}): any;
//# sourceMappingURL=router.d.ts.map