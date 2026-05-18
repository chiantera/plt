export declare const eventHandlers: {
    readonly deployBuilding: "deploy_building";
    readonly deploySucceeded: "deploy_succeeded";
    readonly deployFailed: "deploy_failed";
    readonly deployDeleted: "deploy_deleted";
    readonly deployLocked: "deploy_locked";
    readonly deployUnlocked: "deploy_unlocked";
    readonly formSubmitted: "submission_created";
    readonly userLogin: "identity_login";
    readonly userSignup: "identity_signup";
    readonly userValidate: "identity_validate";
    readonly userModified: "identity_usermodified";
    readonly userDeleted: "identity_userdeleted";
    readonly fetch: "fetch";
};
export type EventHandlerName = keyof typeof eventHandlers;
export declare const isIdentityEvent: (eventSlug: string) => boolean;
