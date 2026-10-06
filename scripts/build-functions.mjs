// Собирает общий код (src/server/shared.ts) в один ES-модуль для Edge Functions (Deno).
// Файл коммитится: `supabase functions deploy` берёт его как есть.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

// Deno проверяет типы пушей отдельно: esbuild удаляет их из app.js.
const rules = ts.createSourceFile('rules.ts', await readFile('src/notify/rules.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const types = rules.statements.filter(n => ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)).map(n => n.getText(rules));
await writeFile('supabase/functions/_shared/notify-types.ts', '// Сгенерировано scripts/build-functions.mjs — не править руками.\n' + types.join('\n\n') + '\n');

await build({
  entryPoints: ['src/server/shared.ts'],
  outfile: 'supabase/functions/_shared/app.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  loader: { '.json': 'json' },
  define: { 'process.env.EXPO_PUBLIC_DEMO_CLOCK': 'undefined', __DEV__: 'false' },
  banner: { js: '// Сгенерировано scripts/build-functions.mjs из src/server/shared.ts — не править руками.' },
  logLevel: 'info',
});
