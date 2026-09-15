// Uses already-installed tooling. No mocks, query rewrites, or Babel config loading.
const babel = require('@babel/core');
const commonjs = require('@babel/plugin-transform-modules-commonjs');

module.exports = {
  process(source, filename) {
    return babel.transformSync(source, {
      filename,
      babelrc: false,
      configFile: false,
      plugins: [commonjs],
      sourceMaps: 'inline',
    });
  },
};
