/**
 * Sandbox Provider Interface
 *
 * Pluggable architecture for different sandbox backends:
 * - Local (development, direct process execution)
 * - Fly Machines (production, ephemeral containers)
 * - Vercel Sandbox (serverless)
 * - E2B, Modal, AWS, etc.
 *
 * Inspired by: https://docs.claude.com/en/api/agent-sdk/hosting
 */
/**
 * Factory for creating sandbox providers
 */
export class SandboxProviderFactory {
    static async create(config) {
        switch (config.type) {
            case 'local': {
                const { LocalSandboxProvider } = await import('./providers/local-sandbox');
                return new LocalSandboxProvider(config.local);
            }
            case 'fly': {
                const { FlyMachinesSandboxProvider } = await import('./providers/fly-sandbox');
                return new FlyMachinesSandboxProvider(config.fly);
            }
            case 'vercel': {
                const { VercelSandboxProvider } = await import('./providers/vercel-sandbox');
                return new VercelSandboxProvider(config.vercel);
            }
            // TODO: Implement additional providers
            // case 'e2b': {
            //   const { E2BSandboxProvider } = await import('./providers/e2b-sandbox');
            //   return new E2BSandboxProvider(config.e2b);
            // }
            // case 'modal': {
            //   const { ModalSandboxProvider } = await import('./providers/modal-sandbox');
            //   return new ModalSandboxProvider(config.modal);
            // }
            // case 'custom': {
            //   const { CustomSandboxProvider } = await import('./providers/custom-sandbox');
            //   return new CustomSandboxProvider(config.custom);
            // }
            default:
                throw new Error(`Unknown sandbox provider type: ${config.type}`);
        }
    }
}
