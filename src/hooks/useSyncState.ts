/** מצב הסנכרון כהוק, כדי שמסך ההגדרות יוכל להציג את האמת. */
import { useSyncExternalStore } from 'react';
import { getSyncState, subscribeSyncState } from '@/lib/sync';

export function useSyncState() {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}
