"use strict";
const util_1 = require("util");
const isUrl = require("is-url-superb");
const postcss_1 = require("postcss");
const postcss_values_parser_1 = require("postcss-values-parser");
const debug = (0, util_1.debuglog)('detective-postcss');
function detective(src, options = { url: false }) {
    let references = [];
    let root;
    try {
        root = (0, postcss_1.parse)(src);
    }
    catch {
        throw new detective.MalformedCssError();
    }
    root.walkAtRules((rule) => {
        let file = null;
        if (isImportRule(rule)) {
            const firstNode = (0, postcss_values_parser_1.parse)(rule.params).first;
            if (firstNode) {
                file = getValueOrUrl(firstNode);
                if (file) {
                    debug('found %s of %s', '@import', file);
                }
            }
        }
        if (isValueRule(rule)) {
            const lastNode = (0, postcss_values_parser_1.parse)(rule.params).last;
            if (!lastNode)
                return;
            const prevNode = lastNode.prev();
            if (prevNode && isFrom(prevNode)) {
                file = getValueOrUrl(lastNode);
                if (file) {
                    debug('found %s of %s', '@value with import', file);
                }
            }
            if (options.url && isUrlNode(lastNode)) {
                file = getValueOrUrl(lastNode);
                if (file) {
                    debug('found %s of %s', 'url() in @value', file);
                }
            }
        }
        if (file)
            references.push(file);
    });
    if (!options.url)
        return references;
    root.walkDecls((decl) => {
        const { nodes } = (0, postcss_values_parser_1.parse)(decl.value);
        const files = nodes
            .filter((node) => isUrlNode(node))
            .map((node) => getValueOrUrl(node))
            .filter((file) => Boolean(file));
        for (const file of files) {
            debug('found %s of %s', 'url() in declaration', file);
        }
        references = references.concat(files);
    });
    return references;
}
function getValueOrUrl(node) {
    const ret = isUrlNode(node) ? getUrlContent(node) : getValue(node);
    // is-url-superb uses new URL() which doesn't accept protocol-relative URLs;
    // prepend http: so they get correctly identified and filtered out
    return !isUrl(ret.startsWith('//') ? `http:${ret}` : ret) && ret;
}
function getUrlContent(urlNode) {
    const first = urlNode.nodes[0];
    // Quoted: url('foo.css') or url("foo.css")
    if (first && first.type === 'quoted') {
        return first.contents;
    }
    // Unquoted: reconstruct the full string from all child nodes (handles
    // absolute URLs like url(https://...) which parse as multiple tokens)
    return urlNode.nodes
        .filter((n) => isNodeWithValue(n))
        .map((n) => getValue(n))
        .join('');
}
function getValue(node) {
    if (!isNodeWithValue(node)) {
        throw new Error('Unexpectedly found a node without a value');
    }
    return node.type === 'quoted' ? node.contents : node.value;
}
function isNodeWithValue(node) {
    return ['word', 'numeric', 'operator', 'punctuation', 'quoted'].includes(node.type);
}
function isUrlNode(node) {
    return node.type === 'func' && node.name === 'url';
}
function isValueRule(rule) {
    return rule.name === 'value';
}
function isImportRule(rule) {
    return rule.name === 'import';
}
function isFrom(node) {
    return node.type === 'word' && node.value === 'from';
}
(function (detective) {
    class MalformedCssError extends Error {
    }
    detective.MalformedCssError = MalformedCssError;
})(detective || (detective = {}));
module.exports = detective;
