# Значки карты владельца (набор «meets-map-icons», 99 штук, 64×70 pt, тень внутри снизу, якорь — низ).
# Раскладывает архивы 1x/2x/3x в assets/map/sprites (id.png, id@2x.png, id@3x.png — телефон берёт свою плотность),
# сжимает палитрой и пишет src/map/sprites.ts и assets/map/icons.json (группы и подписи).
# Запуск: python3 scripts/map-icons.py <папка, где лежат распакованные 1x/ 2x/ 3x/ и icons.json>
import glob, json, os, shutil, sys
from PIL import Image

src = sys.argv[1]
def find(name):
    hits = glob.glob(os.path.join(src, '**', name), recursive=True)
    if not hits: sys.exit(f'нет {name} в {src}')
    return hits[0]

meta = json.load(open(find('icons.json'), encoding='utf8'))
ids = [i['id'] for g in meta['groups'] for i in g['icons']]
out = 'assets/map/sprites'
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
for scale, suffix in (('1x', ''), ('2x', '@2x'), ('3x', '@3x')):
    folder = os.path.dirname(find(os.path.join(scale, f'{ids[0]}.png')))
    for i in ids:
        Image.open(os.path.join(folder, f'{i}.png')).convert('RGBA').quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE) \
            .save(os.path.join(out, f'{i}{suffix}.png'), optimize=True)
json.dump(meta, open('assets/map/icons.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
lines = '\n'.join(f"  '{i}': require('../../assets/map/sprites/{i}.png')," for i in ids)
open('src/map/sprites.ts', 'w', encoding='utf8').write(
    '// Создано scripts/map-icons.py — не править руками. Значки карты владельца: 64×70 pt, якорь — низ (тень внутри картинки).\n'
    '/* eslint-disable @typescript-eslint/no-require-imports */\n'
    f'export const SPRITES = {{\n{lines}\n}} as const;\nexport type SpriteName = keyof typeof SPRITES;\n'
    '/** Размер значка в pt (ширина × высота). */\nexport const SPRITE_PT = { w: 64, h: 70 } as const;\n')
print(len(ids), 'значков')
