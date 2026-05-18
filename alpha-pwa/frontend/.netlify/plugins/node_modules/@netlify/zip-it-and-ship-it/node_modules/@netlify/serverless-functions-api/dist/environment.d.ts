import { InvocationMetadata } from './metadata.js';
interface EnvironmentVariables {
    directory: string;
    encryptionKey: string;
}
interface EnvironmentOptions {
    aiGateway?: string;
    blobs?: string;
    environmentVariables?: EnvironmentVariables;
    env?: NodeJS.ProcessEnv;
    headers: Headers;
    invocationMetadata?: InvocationMetadata;
    netlifyDBURL?: string;
    purgeAPIToken?: string;
}
export declare const setupEnvironment: ({ aiGateway, blobs, environmentVariables, env, headers, invocationMetadata, netlifyDBURL, purgeAPIToken, }: EnvironmentOptions) => Promise<void>;
/** @internal Resets the injection state. Exported for testing only. */
export declare const resetInjectedEnvVars: () => void;
export {};
