/**
 * Extension OAuth - Simplified OAuth flow for browser extensions and VS Code extensions
 *
 * Generic OAuth callback handler that:
 * - Detects custom OAuth flows via state parameter marker
 * - Handles token exchange automatically
 * - Sends postMessage to opener window
 * - Allows custom state data and callbacks
 */
import { Request, Response, NextFunction } from 'express';
export interface ExtensionOAuthState {
    /**
     * Marker to identify this as an extension OAuth flow (not MCP)
     * Can be any truthy value - the library just checks if it exists
     */
    isExtensionAuth?: boolean | string | number;
    /**
     * Any custom data your application needs
     */
    [key: string]: any;
}
export interface ExtensionOAuthConfig {
    /**
     * Enable extension OAuth callback handler
     * Default: false
     */
    enabled?: boolean;
    /**
     * Detect if this is an extension OAuth callback
     * Default: checks if state.isExtensionAuth is truthy
     *
     * @param stateData - Decoded state object
     * @returns true if this should be handled as extension OAuth
     */
    isExtensionOAuth?: (stateData: any) => boolean;
    /**
     * Custom callback after successful OAuth
     * Receives the decoded state and user info
     *
     * @param stateData - The decoded state object with your custom data (read-only)
     * @param userId - User ID from OAuth provider
     * @param userInfo - Complete user info from provider
     * @returns Optional object to merge into the response sent to client
     */
    onUserAuthenticated?: (stateData: any, userId: string, userInfo: {
        email?: string;
        provider: string;
        [key: string]: any;
    }) => void | Promise<void | any>;
    /**
     * Custom token exchange handlers per provider
     * If not provided, uses default handlers for google/github
     */
    tokenExchangeHandlers?: {
        [provider: string]: (code: string, callbackUrl: string) => Promise<{
            userId: string;
            email?: string;
            [key: string]: any;
        }>;
    };
    /**
     * Override default success HTML template
     *
     * @param user - User info
     * @param stateData - The decoded state object
     */
    successTemplate?: (user: {
        id: string;
        email?: string;
        [key: string]: any;
    }, stateData: any) => string;
    /**
     * Override default error HTML template
     */
    errorTemplate?: (error: string, stateData?: any) => string;
    /**
     * Customize the postMessage data
     * Default: { type: 'oauth-complete', success: true/false, user: {...}, error: '...' }
     */
    customizePostMessage?: (success: boolean, user?: any, error?: string, stateData?: any) => any;
}
/**
 * Decode OAuth state parameter
 */
export declare function decodeOAuthState(state: string | undefined): any | null;
/**
 * Encode OAuth state
 */
export declare function encodeOAuthState(data: any): string;
/**
 * Create extension OAuth callback middleware
 */
export declare function createExtensionOAuthHandler(config?: ExtensionOAuthConfig): (_req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=extension-oauth.d.ts.map