// Общая настройка тестов: хранилище устройства заменяем моком.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Resolve Expo's lazy fetch while the preset's native mocks are still active.
// Otherwise Jest's global cleanup can import it after component tests have ended.
void globalThis.fetch;
