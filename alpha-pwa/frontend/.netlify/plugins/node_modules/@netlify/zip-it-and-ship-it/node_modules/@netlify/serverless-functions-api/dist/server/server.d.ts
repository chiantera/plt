import { type Server } from 'node:http';
export interface StartServerOptions {
    port?: number;
    host?: string;
    logFileDescriptor?: number;
    readyFileDescriptor?: number;
    keepWarmFileDescriptor?: number;
}
export interface ServerInstance {
    server: Server;
    port: number;
    close: () => Promise<void>;
}
export declare const startServer: (funcPath: string, options?: StartServerOptions) => Promise<ServerInstance>;
