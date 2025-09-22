module.exports = {
  env: { node: true, es2022: true },
  extends: ['eslint:recommended', 'plugin:n/recommended', 'prettier'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: { 'n/no-unsupported-features/es-syntax': 'off' },
};
