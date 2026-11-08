// Browser stub for chalk. The replay engine only uses chalk for its optional
// terminal renderer, which the web viewer never calls.
const identity = (value) => value;
module.exports = new Proxy(identity, { get: () => identity });
