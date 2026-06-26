const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const originalLoad = Module._load;
Module._load = function loadWithExpoMocks(request, parent, isMain) {
  if (request === 'expo-secure-store' && global.__expoSecureStoreMock) {
    return global.__expoSecureStoreMock;
  }

  return originalLoad.call(this, request, parent, isMain);
};

require.extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  module._compile(output.outputText, filename);
};
