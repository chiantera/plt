import type { IncomingMessage } from 'node:http';
export declare const getRequestUrl: (nodeRequest: IncomingMessage) => string;
export declare const isUpgraded: (response: unknown) => boolean;
