import { CookieStore } from '../cookie_store.js';
import { type FunctionExport } from '../function.js';
import { NetlifyRequest } from '../request.js';
import type { RequestContext } from '../request.js';
export interface PrepareRequestOptions {
    funcPath: string;
    url: string;
    headers: Headers;
    method: string;
    body?: BodyInit | null;
    waitUntil: (promise: Promise<unknown>) => void;
}
export declare const prepareRequest: ({ funcPath, url, headers, method, body, waitUntil }: PrepareRequestOptions) => Promise<{
    req: NetlifyRequest;
    requestContext: RequestContext;
    cookies: CookieStore;
    importDurationMs: number;
    funcModule: FunctionExport;
    handler: {
        type: "http";
        handler: import("../function.js").RequestHandler;
    } | {
        type: "event";
        handler: import("../function.js").EventHandler;
        eventName: string;
    };
}>;
