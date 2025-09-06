/**
 * Simple Template Engine for OAuth Pages
 * 
 * Provides customizable branding and styling for OAuth authentication pages.
 * Supports template variables, custom CSS, and branding configuration.
 */

export interface TemplateConfig {
  /** Application branding */
  branding?: {
    appName?: string;
    appLogo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  
  /** Custom CSS to override default styles */
  customCSS?: string;
  
  /** Template variables */
  variables?: Record<string, any>;
  
  /** Enable dark mode support */
  darkMode?: boolean;
}

export interface TemplateData {
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
 * Simple template engine using string replacement
 */
export class TemplateEngine {
  private config: TemplateConfig;
  
  constructor(config: TemplateConfig = {}) {
    this.config = {
      branding: {
        appName: 'Simple RPC AI Backend',
        primaryColor: '#007acc',
        secondaryColor: '#005a99',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        ...config.branding
      },
      darkMode: false,
      ...config
    };
  }
  
  /**
   * Render a template with data
   */
  render(template: string, data: TemplateData & { config?: TemplateConfig }): string {
    // Merge template config
    const templateConfig = { ...this.config, ...data.config };
    
    // Prepare template variables
    const variables = {
      // Branding
      APP_NAME: templateConfig.branding?.appName || 'Simple RPC AI Backend',
      APP_LOGO: templateConfig.branding?.appLogo || '',
      FAVICON: templateConfig.branding?.favicon || '',
      PRIMARY_COLOR: templateConfig.branding?.primaryColor || '#007acc',
      SECONDARY_COLOR: templateConfig.branding?.secondaryColor || '#005a99',
      BACKGROUND_COLOR: templateConfig.branding?.backgroundColor || '#ffffff',
      TEXT_COLOR: templateConfig.branding?.textColor || '#333333',
      
      // Dynamic content
      PROVIDERS_HTML: this.renderProviders(data.providers),
      ERROR_HTML: data.error ? this.renderError(data.error) : '',
      
      // Conditional HTML parts
      FAVICON_LINK: templateConfig.branding?.favicon 
        ? `<link rel="icon" href="${templateConfig.branding.favicon}">`
        : '',
      LOGO_HTML: templateConfig.branding?.appLogo
        ? `<img src="${templateConfig.branding.appLogo}" alt="${templateConfig.branding.appName || 'App'}" class="app-logo">`
        : '<div class="app-logo">🔐</div>',
      NO_PROVIDERS_HTML: data.providers.length === 0
        ? `<div class="no-providers">❌ No identity providers are configured.<br>Please check your environment variables.</div>`
        : '',
      
      // CSS
      CUSTOM_CSS: templateConfig.customCSS || '',
      DARK_MODE_CLASS: templateConfig.darkMode ? 'dark-mode' : '',
      
      // Custom variables
      ...templateConfig.variables
    };
    
    // Replace template variables
    let rendered = template;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
    });
    
    return rendered;
  }
  
  /**
   * Render providers list HTML
   */
  private renderProviders(providers: TemplateData['providers']): string {
    return providers.map(provider => `
      <a href="${provider.loginUrl}" class="provider-button">
        ${provider.icon ? `<span class="provider-icon">${provider.icon}</span>` : ''}
        <div class="provider-content">
          <strong class="provider-name">${provider.displayName}</strong>
          <small class="provider-description">Sign in with ${provider.displayName}</small>
        </div>
      </a>
    `).join('');
  }
  
  /**
   * Render error message HTML
   */
  private renderError(error: { code: string; message: string }): string {
    return `
      <div class="error-message">
        <h3>Authentication Error</h3>
        <p><strong>Error:</strong> ${error.code}</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

/**
 * Get default login page template
 */
export function getDefaultLoginTemplate(): string {
  return `
<!DOCTYPE html>
<html lang="en" class="{{DARK_MODE_CLASS}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In - {{APP_NAME}}</title>
  {{FAVICON_LINK}}
  <style>
    /* Reset and base styles */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, {{BACKGROUND_COLOR}} 0%, #f8f9fa 100%);
      color: {{TEXT_COLOR}};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .login-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      padding: 40px;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    
    .app-logo {
      width: 60px;
      height: 60px;
      margin: 0 auto 20px;
      background: {{PRIMARY_COLOR}};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
    
    h1 {
      color: {{TEXT_COLOR}};
      margin-bottom: 8px;
      font-size: 24px;
      font-weight: 600;
    }
    
    .subtitle {
      color: #666;
      margin-bottom: 32px;
      font-size: 14px;
    }
    
    .providers {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .provider-button {
      display: flex;
      align-items: center;
      padding: 16px;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      text-decoration: none;
      color: {{TEXT_COLOR}};
      background: white;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .provider-button:hover {
      border-color: {{PRIMARY_COLOR}};
      background: #f8f9fa;
      transform: translateY(-1px);
    }
    
    .provider-icon {
      width: 20px;
      height: 20px;
      margin-right: 12px;
      font-size: 20px;
    }
    
    .provider-content {
      flex: 1;
      text-align: left;
    }
    
    .provider-name {
      display: block;
      font-weight: 500;
      margin-bottom: 2px;
    }
    
    .provider-description {
      color: #666;
      font-size: 12px;
    }
    
    .error-message {
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    
    .error-message h3 {
      color: #c33;
      margin-bottom: 8px;
      font-size: 16px;
    }
    
    .error-message p {
      margin-bottom: 4px;
      font-size: 14px;
    }
    
    .no-providers {
      color: #c33;
      padding: 20px;
      background: #fee;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
    }
    
    /* Dark mode support */
    .dark-mode body {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #ffffff;
    }
    
    .dark-mode .login-container {
      background: #2d2d2d;
      color: #ffffff;
    }
    
    .dark-mode .provider-button {
      background: #3d3d3d;
      border-color: #555;
      color: #ffffff;
    }
    
    .dark-mode .provider-button:hover {
      background: #4d4d4d;
    }
    
    /* Responsive design */
    @media (max-width: 480px) {
      .login-container {
        padding: 24px;
      }
      
      h1 {
        font-size: 20px;
      }
    }
    
    /* Custom CSS override */
    {{CUSTOM_CSS}}
  </style>
</head>
<body>
  <div class="login-container">
    {{LOGO_HTML}}
    
    <h1>Welcome to {{APP_NAME}}</h1>
    <p class="subtitle">Choose your identity provider to continue</p>
    
    {{ERROR_HTML}}
    
    <div class="providers">
      {{PROVIDERS_HTML}}
    </div>
    
    {{NO_PROVIDERS_HTML}}
    
    <div class="footer">
      Powered by {{APP_NAME}}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Provider icons for common identity providers
 */
export const PROVIDER_ICONS: Record<string, string> = {
  google: '🟢',
  github: '⚫',
  microsoft: '🔵',
  facebook: '🔵',
  twitter: '🐦',
  linkedin: '💼',
  apple: '🍎'
};

/**
 * Default template configurations
 */
export const DEFAULT_TEMPLATES = {
  // Corporate theme
  corporate: {
    branding: {
      primaryColor: '#2c5282',
      secondaryColor: '#2a4a7a',
      backgroundColor: '#f7fafc',
      textColor: '#2d3748'
    }
  },
  
  // Dark theme
  dark: {
    darkMode: true,
    branding: {
      primaryColor: '#4299e1',
      secondaryColor: '#3182ce',
      backgroundColor: '#1a202c',
      textColor: '#ffffff'
    }
  },
  
  // Minimal theme
  minimal: {
    branding: {
      primaryColor: '#000000',
      secondaryColor: '#333333',
      backgroundColor: '#ffffff',
      textColor: '#000000'
    },
    customCSS: `
      .login-container {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .provider-button {
        border-color: #000;
      }
      .provider-button:hover {
        background: #f5f5f5;
      }
    `
  }
};