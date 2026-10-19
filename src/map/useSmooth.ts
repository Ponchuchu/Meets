// Плавное движение друзей (V6 §3.2): новая точка не прыгает, а доезжает за ~1,2 с (≈15 кадров в секунду).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FriendSpot } from '../data/types';

const MS = 1200;
const STEP = 66;
const ease = (t: number) => 1 - (1 - t) ** 3;

export function useSmoothSpots(spots: FriendSpot[]): FriendSpot[] {
  const [shown, setShown] = useState(spots);
  const shownRef = useRef(spots);
  useEffect(() => {
    const from = new Map(shownRef.current.map((s) => [s.personId, s]));
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / MS);
      const k = ease(t);
      const next = spots.map((s) => {
        const a = from.get(s.personId);
        // Новый друг или большой скачок (> ~3 км) — без анимации.
        if (!a || Math.abs(a.lat - s.lat) + Math.abs(a.lon - s.lon) > 0.03) return s;
        return { ...s, lat: a.lat + (s.lat - a.lat) * k, lon: a.lon + (s.lon - a.lon) * k };
      });
      shownRef.current = next;
      setShown(next);
      return t >= 1;
    };
    const moving = spots.some(s => { const a = from.get(s.personId); return a && (a.lat !== s.lat || a.lon !== s.lon) && Math.abs(a.lat-s.lat)+Math.abs(a.lon-s.lon)<=.03; });
    if (!moving) { shownRef.current = spots; return; }
    const id = setInterval(() => { if (tick()) { clearInterval(id); } }, STEP);
    return () => clearInterval(id);
  }, [spots]);
  return useMemo(() => spots.map(s => {
    const a = shown.find(x => x.personId === s.personId);
    if (!a || Math.abs(a.lat-s.lat)+Math.abs(a.lon-s.lon)>.03) return s;
    return a.lat === s.lat && a.lon === s.lon ? s : { ...s, lat: a.lat, lon: a.lon };
  }), [spots, shown]);
}
