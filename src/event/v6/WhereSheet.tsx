// Расчёт маршрута для экрана «Маршрут»: пешком и машина — функция route, автобус и метро — свой расчёт.
// Окно выбора «где строить маршрут» убрано (21 окт.): «Маршрут» сразу открывает карту с точкой.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { EventItem } from '../../data/types';
import { getRoute } from '../../live/api';
import { distM } from '../../live/geo';
import { busFor, transitFor } from '../../transit/almaty';
import type { TransitOption } from '../../transit/router';

export function useTrip(e: EventItem, me: { lat: number; lon: number } | null, mode: 'walk' | 'car' | 'bus' = 'walk') {
  // Место «примерно» (needsPin) — точного маршрута не строим, только оценка по прямой.
  const enabled = mode !== 'bus' && !!me && !e.needsPin && !e.noPoint;
  const q = useQuery({ queryKey: ['route', e.id, me ? `${me.lat.toFixed(3)},${me.lon.toFixed(3)}` : ''], queryFn: () => getRoute(me!, e), enabled, staleTime: 10 * 60e3, retry: 0, placeholderData:(previous,query)=>query?.queryKey[1]===e.id?previous:undefined });
  // Последний удачный маршрут к этому событию: пока считается новый (сдвинулся на 100 м) или запрос не удался,
  // линия на карте не пропадает — раньше после «автобус → пешком» путь мог исчезнуть совсем.
  // Берём его из кэша запросов (ключ ['route', событие, точка]).
  const qc = useQueryClient();
  const route = q.data ?? qc.getQueryCache().findAll({ queryKey: ['route', e.id] })
    .filter(x => x.state.data).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0]?.state.data as typeof q.data ?? null;
  const loading = enabled && q.isPending && !route;
  const bus = useMemo(() => mode === 'bus' && me && !e.needsPin && !e.noPoint ? busFor(me, e, new Date()) : null, [e, me?.lat, me?.lon, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Автобусы и метро с пересадками — считаем всегда (раньше только в режиме «автобус», которого экран не передавал).
  const meKey = me ? `${me.lat.toFixed(3)},${me.lon.toFixed(3)}` : '';
  // Расчёт ~0,3 с — после анимации перехода, чтобы экран не подтормаживал.
  const [transit, setTransit] = useState<TransitOption[]>([]);
  useEffect(() => {
    if (!me || e.noPoint) return;
    const task = InteractionManager.runAfterInteractions(() => { setTransit(transitFor(me, e, new Date())); });
    return () => task.cancel();
  }, [e.id, e.lat, e.lon, meKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Без сети или без ответа — по прямой × 1,3, с пометкой «примерно».
  const straight = me ? distM(me, e) * 1.3 : 0;
  const walkMin = route?.walk?.min ?? (me && !e.noPoint && !loading ? Math.round(straight / 75) : null);
  const carMin = route?.car?.min ?? (me && !e.noPoint && !loading ? Math.max(3, Math.round(straight / 400)) : null);
  return { route, bus, transit, walkMin, carMin, rough: !route && !loading, loading };
}

