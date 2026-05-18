export declare const getSystemLogSink: () => {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
export declare const setSystemLogSinkToFD: (logFD: number) => void;
