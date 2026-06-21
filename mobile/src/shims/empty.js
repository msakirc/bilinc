// Universal stub for Node core modules (node:https, node:http2, node:stream,
// node:events, ...) pulled in transitively by @smithy/node-http-handler.
// React Native has no Node builtins. A plain `{}` is not enough: node-http-handler
// does `class XxxHandler extends <Writable|EventEmitter>`, and an undefined super
// throws "Super expression must either be null or a function" at module load.
//
// Exporting a callable function via a catch-all Proxy makes every named import
// resolve to a function — which is simultaneously a valid superclass (`extends`),
// callable, and constructable — so the module evaluates without crashing. None of
// it is ever invoked at runtime: the AWS SDK is configured to use the fetch-based
// request handler (see src/services/dynamodb.ts).
function noop() {}
const handler = {
  get: (_t, prop) => (prop === '__esModule' ? true : noop),
  apply: () => undefined,
  construct: () => ({}),
};
module.exports = new Proxy(noop, handler);
