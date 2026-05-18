"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
function register(zod) {
    if (typeof zod.ZodType.prototype.meta !== 'undefined') {
        return;
    }
    zod.ZodType.prototype.meta = function (meta) {
        this._def.meta = Object.assign(Object.assign({}, this._def.meta), meta);
        return this;
    };
    zod.ZodType.prototype.getMeta = function () {
        return this._def.meta;
    };
}
exports.register = register;
