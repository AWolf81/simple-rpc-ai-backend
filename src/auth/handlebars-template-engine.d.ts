/**
 * Handlebars-based Template Engine for OAuth Pages
 *
 * Cleaner, more maintainable templating using express-handlebars
 * with customizable branding and styling for OAuth authentication pages.
 */
export interface HandlebarsTemplateConfig {
    /** Application branding */
    branding?: {
        appName?: string;
        appLogo?: string;
        favicon?: string;
        primaryColor?: string;
        secondaryColor?: string;
        backgroundColor?: string;
        textColor?: string;
        /** Optional footer text override (set to empty string or null to hide) */
        footerText?: string | null;
        /** Hide the footer entirely */
        hideFooter?: boolean;
    };
    /** Custom CSS to override default styles */
    customCSS?: string;
    /** Template variables */
    variables?: Record<string, any>;
    /** Enable dark mode support */
    darkMode?: boolean;
}
export interface HandlebarsTemplateData {
    /** Available identity providers */
    providers: Array<{
        name: string;
        displayName: string;
        loginUrl: string;
        icon?: string;
    }>;
    /** OAuth flow context */
    context?: {
        redirectUri?: string;
        clientId?: string;
        scopes?: string[];
    };
    /** Error information */
    error?: {
        code: string;
        message: string;
    };
}
/**
 * Handlebars template engine with OAuth-specific helpers
 */
export declare class HandlebarsTemplateEngine {
    private hbs;
    private config;
    constructor(config?: HandlebarsTemplateConfig);
    /**
     * Render a template with data
     */
    render(templateName: string, data: HandlebarsTemplateData): Promise<string>;
    /**
     * Update configuration
     */
    updateConfig(config: HandlebarsTemplateConfig): void;
    /**
     * Get current configuration
     */
    getConfig(): HandlebarsTemplateConfig;
}
/**
 * Provider icons for common identity providers (now using SVG icons)
 */
export declare const HANDLEBARS_PROVIDER_ICONS: Record<string, string>;
/**
 * Default template configurations
 */
export declare const HANDLEBARS_DEFAULT_TEMPLATES: {
    readonly corporate: {
        readonly branding: {
            readonly primaryColor: "#2c5282";
            readonly secondaryColor: "#2a4a7a";
            readonly backgroundColor: "#f7fafc";
            readonly textColor: "#2d3748";
        };
    };
    readonly dark: {
        readonly darkMode: true;
        readonly branding: {
            readonly primaryColor: "#4299e1";
            readonly secondaryColor: "#3182ce";
            readonly backgroundColor: "#1a202c";
            readonly textColor: "#ffffff";
        };
    };
    readonly minimal: {
        readonly branding: {
            readonly primaryColor: "#000000";
            readonly secondaryColor: "#333333";
            readonly backgroundColor: "#ffffff";
            readonly textColor: "#000000";
        };
        readonly customCSS: "\n      .login-container {\n        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\n      }\n      .provider-button {\n        border-color: #000;\n      }\n      .provider-button:hover {\n        background: #f5f5f5;\n      }\n    ";
    };
};
//# sourceMappingURL=handlebars-template-engine.d.ts.map