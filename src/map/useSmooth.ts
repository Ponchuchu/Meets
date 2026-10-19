// Плавное движение друзей: кадры согласованы с экраном, неподвижные точки не запускают анимацию.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FriendSpot } from '../data/types';

const MS = 1200;
const STEP = 1000 / 30; // React-маркеры — до 30 обновлений/с; сама карта рисуется нативно до 60.
const ease = (t: number) => 1 - (1 - t) ** 3;

export function useSmoothSpots(spots: FriendSpot[]): FriendSpot[] {
  const [shown, setShown] = useState(spots);
  const shownRef = useRef(spots);
  useEffect(() => {
    const from = new Map(shownRef.current.map((s) => [s.personId, s]));
    const moving = spots.some(s => {
      const a = from.get(s.personId);
      const delta = a ? Math.abs(a.lat - s.lat) + Math.abs(a.lon - s.lon) : 0;
      return delta > 0 && delta <= 0.03;
    });
    if (!moving) { shownRef.current = spots; return; }
    const start = Date.now();
    let last = -Infinity;
    let frame = 0;
    const tick = (stamp: number) => {
      const t = Math.min(1, (Date.now() - start) / MS);
      if (stamp - last < STEP && t < 1) { frame = requestAnimationFrame(tick); return; }
      last = stamp;
      const k = ease(t);
      const next = spots.map((s) => {
        const a = from.get(s.personId);
        // Новый друг или большой скачок (> ~3 км) — без анимации.
        if (!a || Math.abs(a.lat - s.lat) + Math.abs(a.lon - s.lon) > 0.03) return s;
        return { ...s, lat: a.lat + (s.lat - a.lat) * k, lon: a.lon + (s.lon - a.lon) * k };
      });
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spots]);
  return useMemo(() => spots.map(s => {
    const a = shown.find(x => x.personId === s.personId);
    if (!a || Math.abs(a.lat - s.lat) + Math.abs(a.lon - s.lon) > 0.03) return s;
    return a.lat === s.lat && a.lon === s.lon ? s : { ...s, lat: a.lat, lon: a.lon };
  }), [spots, shown]);
}
