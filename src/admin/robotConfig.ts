// Типы старого ИИ-поиска (выключен 26 октября): нужны только правилу searchProblem, которое проверяет старые запуски и тесты.
export type SearchSources = 'sites' | 'ai' | 'all';

export const modelOk = (m: string) => /^(gemini|kimi|moonshot)-[a-zA-Z0-9.-]+$/.test(m);
