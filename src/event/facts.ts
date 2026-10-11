// Цена, время и место в карточке есть всегда: если данных нет — честная подпись «не указано» и флаг для модератора.
import { almaty } from '../lib/clock';

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const money = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export interface Facts {
  when: string;
  whenMissing: boolean;
  place: string;
  placeMissing: boolean;
  price: string;
  priceMissing: boolean;
  /** Сколько из трёх не нашлось. */
  missing: number;
}

export function eventFacts(e: {
  startsAt?: string | null; venueName?: string | null; address?: string | null;
  priceMin?: number | null; priceMax?: number | null; isFree?: boolean | null;
}): Facts {
  let when = 'дата не указана';
  let whenMissing = true;
  const t = e.startsAt ? Date.parse(e.startsAt) : NaN;
  if (!Number.isNaN(t)) {
    const d = almaty(new Date(t));
    const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const day = `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
    whenMissing = false;
    when = hm === '00:00' ? `${day} · время не указано` : `${day} · ${hm}`;
  }
  const place = [e.venueName, e.address].filter((x): x is string => !!x && x.trim().length > 0).filter((x, i, a) => a.indexOf(x) === i).join(', ');
  const placeMissing = !place || /^место встречи$/i.test(place);
  let price = 'цена не указана';
  let priceMissing = true;
  if (e.isFree || e.priceMin === 0) { price = 'бесплатно'; priceMissing = false; }
  else if (e.priceMin != null) {
    priceMissing = false;
    price = e.priceMax != null && e.priceMax !== e.priceMin ? `${money(e.priceMin)}–${money(e.priceMax)} ₸` : `${money(e.priceMin)} ₸`;
  }
  return { when, whenMissing, place: placeMissing ? 'место не указано' : place, placeMissing, price, priceMissing, missing: +whenMissing + +placeMissing + +priceMissing };
}
