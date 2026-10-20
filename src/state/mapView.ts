// Вид карты (FIX3, решение владельца): «Объёмная» — 3D-дома и рельеф; «Простая» — плоская и лёгкая для слабых телефонов.
// Выбирается в «Линзах», запоминается на устройстве. По умолчанию — простая, если памяти меньше 4 ГБ.
import * as Device from 'expo-device';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from './storage';

export type MapView = '3d' | 'flat';
const weak = (Device.totalMemory ?? 8e9) < 4e9;

export const useMapView = create<{ view: MapView; setView: (v: MapView) => void }>()(persist(
  (set) => ({ view: weak ? 'flat' : '3d', setView: (view) => set({ view }) }),
  { name: 'ryadom-map-view', storage: deviceStorage() },
));
