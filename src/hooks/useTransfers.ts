// src/hooks/useTransfers.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { TransferRecord } from '../types';

export function useTransfers() {
    const transfers = useLiveQuery(
        () => db.transfers.filter((t) => !t.deleted).reverse().sortBy('timestamp'),
        []
    );

    return { transfers: (transfers ?? []) as TransferRecord[] };
}