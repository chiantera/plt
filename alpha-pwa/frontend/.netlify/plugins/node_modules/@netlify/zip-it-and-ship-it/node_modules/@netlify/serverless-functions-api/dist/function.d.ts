import { Context } from './context.js';
import { type EventHandlerName } from './events.js';
export type RequestHandler = (req: Request, context: Context) => Promise<Response | void>;
export type EventHandler = (event: any) => Promise<unknown> | unknown;
export type FunctionHandlers = {
    [K in Exclude<EventHandlerName, 'fetch'>]?: EventHandler;
} & {
    fetch?: RequestHandler;
};
export type FunctionExport = RequestHandler | FunctionHandlers;
export type V2Function = {
    default: RequestHandler;
};
type ResolvedHandler = {
    type: 'http';
    handler: RequestHandler;
} | {
    type: 'event';
    handler: EventHandler;
    eventName: string;
};
export declare const getEventHandler: (moduleExport: FunctionExport, req: Request) => ResolvedHandler;
export {};
