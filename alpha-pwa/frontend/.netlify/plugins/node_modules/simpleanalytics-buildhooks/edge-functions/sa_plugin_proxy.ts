// src/edge-functions/proxy.ts
var proxy_default = async (request, context) => {
  const hostname = new URL(request.url).hostname;
  const url = new URL(`https://simpleanalyticsexternal.com/proxy.js?hostname=${hostname}&path=/simple`);
  return fetch(new Request(url, request));
};
var config = {
  path: "/proxy.js",
  cache: "manual"
};
export {
  config,
  proxy_default as default
};
