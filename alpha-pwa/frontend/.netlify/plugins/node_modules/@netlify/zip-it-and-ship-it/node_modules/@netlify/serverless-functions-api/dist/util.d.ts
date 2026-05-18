export declare const parseBase64JSON: <T>(value: string | null) => T | null;
export declare const encodeBase64JSON: (value: unknown) => string;
export declare const preferDefault: (module: unknown) => unknown;
export declare const awaitEnqueuedPromisesAndRecheck: (enqueuedPromises: Set<Promise<unknown>>) => Promise<void>;
