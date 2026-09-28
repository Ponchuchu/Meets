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
