import type { User } from '@netlify/types';
import type { EventType } from './types.js';
interface IdentityEvent {
    user: User;
}
export declare const identityEvent: EventType<IdentityEvent>;
export declare const identityDeletedEvent: EventType<IdentityEvent>;
export {};
