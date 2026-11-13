'use strict';
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

// Run current workspace sources without building or loading stale shared/dist files.
function compile(module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  });
  module._compile(result.outputText, filename);
}
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === 'jurist-calculator-shared') return require('../../src/index.ts');
  return originalLoad.call(this, request, ...args);
};
