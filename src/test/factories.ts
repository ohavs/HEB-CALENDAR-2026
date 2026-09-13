/** בונים אובייקטים לבדיקות, כדי שכל קובץ בדיקה יתמקד במה שהוא בודק. */
import type { GeoCity, Settings, UserEvent } from '@/types';
import { findCity } from '@/lib/locations';
import { defaultSettings } from '@/store/settings';

export const JERUSALEM: GeoCity = findCity('jerusalem');
export const TEL_AVIV: GeoCity = findCity('telaviv');

/** הגדרות עם עיר קבועה, כדי שהבדיקה לא תושפע מאזור הזמן של המכונה. */
export function settings(patch: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), cityId: 'jerusalem', ...patch };
}

let seq = 0;

export function event(patch: Partial<UserEvent> = {}): UserEvent {
  seq += 1;
  const now = Date.UTC(2026, 0, 1) + seq;
  return {
    id: `ev${seq}`,
    title: `אירוע ${seq}`,
    date: '2026-09-13',
    startTime: '09:00',
    endTime: null,
    allDay: false,
    color: 'violet',
    reminderMinutes: null,
    repeat: 'none',
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

/** אפשרויות לבניית ימים, עם כל המועדים דלוקים. */
export function buildOptions(patch: Record<string, unknown> = {}) {
  return {
    showJewishHolidays: true,
    showIsraeliHolidays: true,
    showMinorHolidays: true,
    showFasts: true,
    showRoshChodesh: true,
    showParsha: true,
    showOmer: true,
    showCandleTimes: true,
    candleLightingMins: 40,
    havdalahMode: 'degrees' as const,
    havdalahDegrees: 8.5,
    havdalahMins: 42,
    city: JERUSALEM,
    ...patch,
  };
}
