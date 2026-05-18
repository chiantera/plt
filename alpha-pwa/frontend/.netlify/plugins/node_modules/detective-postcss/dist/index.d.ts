declare function detective(src: string, options?: detective.Options): string[];
declare namespace detective {
    interface Options {
        url: boolean;
    }
    class MalformedCssError extends Error {
    }
}
export = detective;
