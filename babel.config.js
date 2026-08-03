// Converts local TS/TSX imports to JS imports, used in the components
const rewriteLocalTypeScriptImports = () => {
  const isLocal = (value) => typeof value === 'string' && (value.startsWith('./') || value.startsWith('../'));
  const isComponent = (value) => typeof value === 'string' && value.startsWith('/components/');
  // Every component is compiled to a .js file next to this one, and only /public/ is served, so both extensions have to point there or the browser gets a 404
  const isTypeScript = (value) => typeof value === 'string' && (value.endsWith('.ts') || value.endsWith('.tsx'));
  const toJsFileName = (value) => `${value.slice(0, value.lastIndexOf('.'))}.js`;

  const rewrite = (source) => {
    if (source && isLocal(source.value) && isTypeScript(source.value)) {
      source.value = toJsFileName(source.value);
    }

    if (source && isComponent(source.value) && isTypeScript(source.value)) {
      source.value = toJsFileName(source.value.replace('/components/', '/public/components/'));
    }
  };

  return {
    visitor: {
      ImportDeclaration(path) {
        rewrite(path.node.source);
      },
      ExportAllDeclaration(path) {
        rewrite(path.node.source);
      },
      ExportNamedDeclaration(path) {
        if (path.node.source) rewrite(path.node.source);
      },
    },
  };
};

const presets = [
  ['@babel/preset-react'],
  ['@babel/preset-typescript', { jsxPragma: 'h' }],
];

const plugins = [
  rewriteLocalTypeScriptImports,
  [
    '@babel/plugin-transform-react-jsx',
    {
      'pragma': 'h',
      'pragmaFrag': 'Fragment',
      'jsxImportSource': 'preact',
    },
  ],
];

export default {
  sourceType: 'module',
  targets: '> 0.5%, not dead',
  presets,
  plugins,
  comments: false,
  compact: false,
  minified: false,
};
