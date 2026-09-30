// Общий код приложения и Edge Functions: рекомендации, правила пушей, погода, витрина событий.
// Сборка для Deno: `npm run functions:build` → supabase/functions/_shared/app.js.
export { buildDeck, scoreEvent, tasteFrom, type DeckHistory, type Signal, type SignalKind } from '../reco';
export { buildStartTaste, type StartAnswers, type Taste } from '../reco/startTaste';
export { decide, nextScheduled, reminderAt, DEFAULT_PREFS, type PushCandidate, type PushKind, type PushPrefs, type SentPush } from '../notify/rules';
export { fromOpenMeteo, skyOf, type DayWeather, type OpenMeteoDaily } from '../data/weather';
export { mapFeedRow, type FeedRow } from '../data/feedRow';
export type { EventItem } from '../data/types';
