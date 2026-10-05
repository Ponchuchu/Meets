// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const unusedImports = require('eslint-plugin-unused-imports');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'node_modules/*', 'design/*', '.expo/*', 'jest.setup.js', 'supabase/functions/*'] },
  {
    // Мёртвый код (docs/FIX1.md И0): лишние импорты удаляются автоматически, неиспользуемое — предупреждение.
    plugins: { 'unused-imports': unusedImports },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
]);
