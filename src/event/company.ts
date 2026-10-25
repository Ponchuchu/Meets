// «Компания» на событии (26 октября): один источник для шторки, блока на странице события и профиля.
// Демо — из макета (e.lookers, e.friendsGoing) и заявки на телефоне (usePlans.company); живая — company_requests.
// Процесс описан в docs/COMPANY.md.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { data } from '../data';
import type { EventItem } from '../data/types';
import { config } from '../lib/config';
import { askCompany, getWhoGoes, setLooking, type MyLook } from '../live/api';
import { activeCompany, usePlans, type Mood } from '../state/plans';

const LIVE = config.dataMode !== 'demo';

export const MOODS: [Mood, string][] = [['music', 'Послушать'], ['meet', 'Познакомиться'], ['walk', 'Погулять после'], ['notalone', 'Не идти одному']];
export const moodLabel = (m: string) => MOODS.find(([k]) => k === m)?.[1];
export const NOTE_IDEAS = ['Иду один, буду рад компании', 'Есть лишний билет', 'Могу подвезти', 'Первый раз на таком'];

export interface CompanyPerson { id: string; name: string; photo: string | null; initial: string; tint: string; note: string; common?: string; moods: string[]; friend: boolean }

export function useCompany(e: EventItem, now: Date) {
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const live = useQuery({ queryKey: ['who', e.id], queryFn: () => getWhoGoes(e.id), enabled: LIVE });
  const local = usePlans((s) => s.company[e.id]);
  const started = now.getTime() >= new Date(e.startsAt).getTime();

  const friends = LIVE
    ? (live.data?.friends ?? []).map((p) => ({ id: p.id, name: p.name, photo: p.photo_url, initial: p.name[0]?.toUpperCase() ?? '·', tint: '#D5CFC1' }))
    : e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p && p.isFriend);
  const lookers: CompanyPerson[] = LIVE
    ? (live.data?.lookers ?? []).map((l) => ({ id: l.id, name: l.name, photo: l.photo_url, initial: l.name[0]?.toUpperCase() ?? '·', tint: '#E9C9B6', note: l.note ?? '', moods: l.moods ?? [], friend: l.friend }))
    : (e.lookers ?? []).flatMap((l): CompanyPerson[] => {
      const p = people.find((x) => x.id === l.personId);
      return p ? [{ id: p.id, name: p.name, photo: p.photo, initial: p.initial, tint: p.tint, note: l.note, common: l.common.split(' · ')[0].toLowerCase(), moods: [], friend: p.isFriend }] : [];
    });
  const mine: MyLook | null = LIVE ? live.data?.mine ?? null : activeCompany(local, e, now) ? { moods: local!.moods, visibility: local!.visibility, note: local!.note } : null;

  const start = async (look: MyLook) => {
    if (LIVE) {
      qc.setQueryData(['who', e.id], (old: typeof live.data) => (old ? { ...old, iLook: true, mine: look } : old));
      await setLooking(e.id, true, look).finally(() => void qc.invalidateQueries({ queryKey: ['who', e.id] }));
    } else usePlans.getState().lookForCompany({ eventId: e.id, moods: look.moods as Mood[], visibility: look.visibility, note: look.note });
  };
  const stop = async () => {
    if (LIVE) {
      qc.setQueryData(['who', e.id], (old: typeof live.data) => (old ? { ...old, iLook: false, mine: null } : old));
      await setLooking(e.id, false).finally(() => void qc.invalidateQueries({ queryKey: ['who', e.id] }));
    } else usePlans.getState().withdrawCompany(e.id);
  };
  /** «Пойдём?» — в живой версии сообщение в личный чат (правила для незнакомых — на сервере). */
  const ask = async (id: string) => { if (LIVE) await askCompany(id, e.title); };

  return { friends, lookers, mine, started, count: Math.max(LIVE ? 0 : e.lookingCount, lookers.length) + (mine ? 1 : 0), start, stop, ask };
}
