const {
  AsyncLocalStorage
} = require('async_hooks');
const context = new AsyncLocalStorage();
module.exports = {
  authorized: () => context.getStore() === true,
  run: fn => context.run(true, fn)
};
