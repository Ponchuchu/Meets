# Звуки стикеров (26 октября): короткие синтезированные эффекты, 22 кГц моно, без чужих записей.
# Запуск: python3 scripts/sticker-sounds.py → assets/stickers/sfx/*.wav
import os, wave
import numpy as np

SR = 22050
rng = np.random.default_rng(7)
out = 'assets/stickers/sfx'
os.makedirs(out, exist_ok=True)

def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, a=0.005, d=0.2):
    x = np.arange(n) / SR
    return np.minimum(1, x / a) * np.exp(-x / d)
def noise(sec): return rng.uniform(-1, 1, int(SR * sec))
def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode='same')
def place(total, parts):
    y = np.zeros(int(SR * total))
    for start, s in parts:
        i = int(SR * start); y[i:i + len(s)] += s[:len(y) - i]
    return y
def save(name, y, vol=0.8):
    y = y / (np.abs(y).max() + 1e-9) * vol
    with wave.open(f'{out}/{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())

# Хлопки: три сухих щелчка шума с коротким «телом».
clap = lambda: lowpass(noise(0.12), 3) * env(int(SR * 0.12), 0.001, 0.025)
save('clap', place(0.9, [(0, clap()), (0.24, clap()), (0.48, clap() * 1.1)]))
# Поп: короткий тон, падающий вниз.
x = t(0.18); save('pop', np.sin(2 * np.pi * (900 - 2600 * x) * x) * env(len(x), 0.002, 0.05))
# Вжух (ракета, улёт): шум, проходящий снизу вверх.
x = t(0.9); w = noise(0.9); sweep = np.convolve(w, np.ones(6) / 6, 'same') * np.sin(np.pi * x / 0.9) ** 2
save('whoosh', sweep * (0.4 + x))
# Треск огня: шум с редкими щелчками.
x = t(1.2); base = lowpass(noise(1.2), 8) * 0.3
for s in rng.uniform(0, 1.15, 26): base = base + place(1.2, [(s, noise(0.01) * env(int(SR * 0.01), 0.0005, 0.003))])
save('sizzle', base * np.minimum(1, x * 6) * np.minimum(1, (1.2 - x) * 5), 0.6)
# Кости гремят (череп): быстрые деревянные щелчки.
tick = lambda f: np.sin(2 * np.pi * f * t(0.05)) * env(int(SR * 0.05), 0.0005, 0.01)
save('rattle', place(0.8, [(0.05 * i + rng.uniform(0, 0.02), tick(rng.uniform(900, 1500))) for i in range(14)]))
# Бойнг (пружина): тон с вибрато, уходящий вниз.
x = t(0.7); f = 220 + 160 * np.exp(-x * 4) + 25 * np.sin(2 * np.pi * 14 * x)
save('boing', np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.003, 0.35))
# Удар (мем-текст падает): низкий «бум» и шлепок.
x = t(0.5); boom = np.sin(2 * np.pi * (120 * np.exp(-x * 6) + 45) * x) * env(len(x), 0.002, 0.18)
save('slam', boom + place(0.5, [(0, lowpass(noise(0.06), 2) * env(int(SR * 0.06), 0.001, 0.015) * 0.7)]))
# Звон (очки «блеснули», лайк): два чистых колокольчика.
bell = lambda f: (np.sin(2 * np.pi * f * t(0.9)) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t(0.9))) * env(int(SR * 0.9), 0.002, 0.3)
save('chime', place(1.1, [(0, bell(1318)), (0.12, bell(1760))]), 0.6)
# Храп (луна): мягкий шум с медленным «вдохом».
x = t(1.6); sn = lowpass(noise(1.6), 30) * (np.sin(np.pi * x / 0.8) ** 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * x))
save('snore', sn, 0.6)
# Смешок: «ха-ха-ха» — короткие слоги с формантой.
syll = lambda f: (np.sin(2 * np.pi * f * t(0.11)) + 0.5 * lowpass(noise(0.11), 4)) * np.sin(np.pi * t(0.11) / 0.11)
save('laugh', place(0.85, [(0.0, syll(330)), (0.17, syll(350)), (0.34, syll(320)), (0.51, syll(290))]), 0.7)
print('ok')
