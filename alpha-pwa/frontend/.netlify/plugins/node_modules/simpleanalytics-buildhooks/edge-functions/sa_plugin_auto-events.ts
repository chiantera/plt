// src/edge-functions/auto-events.ts
var auto_events_default = async (request, context) => {
  const url = new URL("https://scripts.simpleanalyticscdn.com/auto-events.js");
  return fetch(new Request(url, request));
};
var config = {
  path: "/auto-events.js",
  cache: "manual"
};
export {
  config,
  auto_events_default as default
};
