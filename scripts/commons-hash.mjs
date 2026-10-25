// Прямые ссылки на фото Викисклада (FIX5): путь upload.wikimedia.org/…/thumb/a/ab/<файл>/960px-<файл> строится по md5 имени файла.
// Special:FilePath отдаёт переадресацию, а Wikimedia отклоняет запросы приложений без подписи — фото мест не грузились.
// Запуск: node scripts/commons-hash.mjs → src/data/commonsHash.ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/data/attractions.ts', 'utf8');
const files = [...new Set([...src.matchAll(/commons\('([^']+)'\)/g)].map((m) => m[1]))];
const rows = files.map((f) => {
  const h = createHash('md5').update(f.replace(/ /g, '_')).digest('hex');
  return `  ${JSON.stringify(f)}: '${h[0]}/${h.slice(0, 2)}',`;
});
writeFileSync('src/data/commonsHash.ts', `// Создано scripts/commons-hash.mjs — не править руками.\nexport const COMMONS_HASH: Record<string, string> = {\n${rows.join('\n')}\n};\n`);
console.log(files.length, 'files');
