// Погода. Демо: статичный прогноз на 7 дней, как в макете. Настоящая — Open-Meteo через Edge Function (этап 8).
export type Sky = 'sun' | 'part' | 'cloud' | 'rain';

export interface DayWeather {
  sky: Sky;
  temp: number;
  text: string;
}

export const SKY_PATHS: Record<Sky, string> = {
  sun: 'M12 8a4 4 0 110 8 4 4 0 010-8zM12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4',
  part: 'M8.5 3v1.3M3 8.5h1.3M4.6 4.6l.9.9M12.4 4.6l-.9.9M6.3 10.2a3 3 0 015-2.6M9 20a3.6 3.6 0 01-.4-7.17A5.4 5.4 0 0119 12.2a3.9 3.9 0 01-.6 7.8z',
  cloud: 'M7 18.5a4 4 0 01-.5-7.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 9z',
  rain: 'M7 15.5a4 4 0 01-.5-7.97A6 6 0 0118 6.5a4.5 4.5 0 01-.5 9zM8 22l1.2-2.5M12 22l1.2-2.5M16 22l1.2-2.5',
};

/** Цвет иконки погоды: солнце — тёплое, дождь — синий, облака — серые. */
export const SKY_COLOR: Record<Sky, string> = { sun: '#D98A00', part: '#B07A1E', cloud: '#6B675F', rain: '#2E6FA8' };

export const DEMO_FORECAST: DayWeather[] = [
  { sky: 'sun', temp: 18, text: 'ясно' },
  { sky: 'part', temp: 16, text: 'переменная облачность' },
  { sky: 'rain', temp: 11, text: 'дождь' },
  { sky: 'part', temp: 14, text: 'переменная облачность' },
  { sky: 'sun', temp: 17, text: 'ясно' },
  { sky: 'sun', temp: 19, text: 'ясно' },
  { sky: 'cloud', temp: 15, text: 'облачно' },
];

export const tempLabel = (t: number) => `${t > 0 ? '+' : ''}${t}°`;

/** Погода прямо сейчас в Алматы: Open-Meteo, без ключа. */
export const OPEN_METEO_NOW = 'https://api.open-meteo.com/v1/forecast?latitude=43.2389&longitude=76.8897&current=temperature_2m,weather_code&timezone=Asia%2FAlmaty';

export function nowFromOpenMeteo(p: { current: { temperature_2m: number; weather_code: number } }): DayWeather {
  return { ...skyOf(p.current.weather_code), temp: Math.round(p.current.temperature_2m) };
}

/** Ответ Open-Meteo (daily), как его кладёт в weather_cache Edge Function weather. */
export interface OpenMeteoDaily {
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[] };
}

/** Код погоды WMO → наша иконка и подпись. */
export function skyOf(code: number): { sky: Sky; text: string } {
  if (code === 0) return { sky: 'sun', text: 'ясно' };
  if (code <= 2) return { sky: 'part', text: 'переменная облачность' };
  if (code === 3) return { sky: 'cloud', text: 'облачно' };
  if (code === 45 || code === 48) return { sky: 'cloud', text: 'туман' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { sky: 'cloud', text: 'снег' };
  if (code >= 95) return { sky: 'rain', text: 'гроза' };
  return { sky: 'rain', text: 'дождь' };
}

/** 7 дней начиная с сегодняшнего (дата по Алматы «ГГГГ-ММ-ДД»). Не хватает дней — добиваем последним. */
export function fromOpenMeteo(p: OpenMeteoDaily, today: string): DayWeather[] {
  const { time, weather_code: codes, temperature_2m_max: temps } = p.daily;
  const start = Math.max(0, time.indexOf(today));
  const out: DayWeather[] = [];
  for (let i = start; i < time.length && out.length < 7; i++) out.push({ ...skyOf(codes[i]), temp: Math.round(temps[i]) });
  if (!out.length) throw new Error('empty forecast');
  while (out.length < 7) out.push(out[out.length - 1]);
  return out;
}
