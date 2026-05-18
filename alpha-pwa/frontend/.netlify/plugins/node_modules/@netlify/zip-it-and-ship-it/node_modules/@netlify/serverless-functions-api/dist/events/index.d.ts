import type { EventType } from './types.js';
export declare const getEventType: (eventSlug: string) => EventType | undefined;
export interface EventPayloadResult {
    payload: unknown;
    error?: undefined;
}
export interface EventPayloadError {
    payload?: undefined;
    error: Response;
}
export declare const parseEventPayload: (eventSlug: string, req: Request) => Promise<EventPayloadResult | EventPayloadError>;
export declare const buildEventResponse: (eventSlug: string, result: unknown) => Response;
