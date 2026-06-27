// Converts local TSX imports to JS imports, used in the components
const rewriteLocalTsxImports = () => {
  const isLocal = (value) => typeof value === 'string' && (value.startsWith('./') || value.startsWith('../'));
  const isComponent = (value) => typeof value === 'string' && value.startsWith('/components/');

  const rewrite = (source) => {
    if (source && isLocal(source.value) && source.value.endsWith('.tsx')) {
      source.value = source.value.replace('.tsx', '.js');
    }

    if (source && isComponent(source.value) && source.value.endsWith('.tsx')) {
      source.value = source.value.replace('/components/', '/public/components/').replace('.tsx', '.js');
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
  rewriteLocalTsxImports,
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
