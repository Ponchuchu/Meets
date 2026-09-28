// Собирает общий код (src/server/shared.ts) в один ES-модуль для Edge Functions (Deno).
// Файл коммитится: `supabase functions deploy` берёт его как есть.
import { build } from 'esbuild';

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
