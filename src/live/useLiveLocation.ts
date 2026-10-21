// Один раз во вкладках: правила «кто видит» с сервера → отправка точки на экране (4 с) и в фоне (2–3 мин).
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../data/client';
import { config } from '../lib/config';
import { useProfile } from '../state/profile';
import { getVisibility } from './api';
import { myId } from './auth';
import type { Place } from './geo';
import { setShareRules, startBackground, stopBackground, useGpsMode, watchForeground } from './location';

async function getPlaces(): Promise<Place[]> {
  const me = myId();
  if (!me) return [];
  const {data,error}=await supabase().from('user_places_points').select('kind,lat,lon').eq('user_id',me);
  if(error)throw error;
  return (data??[]) as Place[];
}

export function useLiveLocation() {
  const live = config.dataMode !== 'demo';
  const marker = useProfile((s) => s.marker);
  const vis = useQuery({ queryKey: ['me', 'visibility'], queryFn: getVisibility, enabled: live, staleTime: 60e3 });
  const places = useQuery({ queryKey: ['me', 'places'], queryFn: getPlaces, enabled: live, staleTime: 10 * 60e3 });

  // «Делиться до» истекло — для телефона это та же невидимка (проверяется при каждой отправке).
  const invisible: boolean | string = marker.invisible ? true : vis.data?.invisible_until ?? false;
  const hiddenRef = useRef(false);
  useEffect(() => {
    hiddenRef.current = invisible === true;
    setShareRules({ invisible, shareUntil: marker.shareUntil, districtOnly: !!vis.data?.district_only, places: places.data ?? [] });
  }, [invisible, marker.shareUntil, vis.data?.district_only, places.data]);

  // На экране — частая точка; ушли в фон — её снимаем, работает фоновая задача.
  useEffect(() => {
    if (!live) return;
    let stop: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let active = AppState.currentState === 'active';
    let generation = 0;
    let starting = false;
    const on = () => {
      if (!active || stop || starting) return;
      starting = true;
      const run = generation;
      void watchForeground().then((s) => {
        if (!active || run !== generation) { s?.(); return; }
        starting = false;
        if (s) { stop = s; if (!hiddenRef.current) void startBackground().catch(() => undefined); }
        // Разрешения нет — тихо проверяем раз в 30 с (никаких окон: спрашивает только карта, один раз).
        else retry = setTimeout(on, 30000);
      }).catch(() => {
        if (!active || run !== generation) return;
        starting = false;
        retry = setTimeout(on, 15000);
      });
    };
    const off = () => { generation++; starting = false; clearTimeout(retry); stop?.(); stop = null; };
    if (active) on();
    const sub = AppState.addEventListener('change', (s) => { active = s === 'active'; if (active) on(); else off(); });
    // Открыли или закрыли карту/навигатор — переключаем точность GPS (перезапуск слежения).
    const mode = useGpsMode.subscribe((s, prev) => { if ((s.precise > 0) !== (prev.precise > 0) && active) { off(); on(); } });
    return () => { active = false; sub.remove(); mode(); off(); };
  }, [live]);

  // Фон: включён, пока не невидимка навсегда. Нет разрешения «Всё время» — просто не запускается.
  useEffect(() => {
    if (!live) return;
    if (invisible === true) void stopBackground();
    else void startBackground().catch(() => undefined);
  }, [live, invisible]);
}
