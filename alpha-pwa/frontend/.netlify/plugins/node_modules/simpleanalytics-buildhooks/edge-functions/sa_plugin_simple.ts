// src/edge-functions/simple.ts
var simple_default = async (request, context) => {
  const url = new URL(request.url);
  url.hostname = "queue.simpleanalyticscdn.com";
  url.pathname = url.pathname.substring(7);
  return fetch(new Request(url, request));
};
var config = {
  path: "/simple/*"
};
export {
  config,
  simple_default as default
};
