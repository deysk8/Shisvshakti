'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/api-client';
import {
  clearBookingLock,
  formatCountdown,
  readBookingLock,
  secondsUntil,
  writeBookingLock,
  type BookingLockSession,
} from '@/lib/booking-session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type LockState = {
  lock: BookingLockSession | null;
  valid: boolean | null;
  secondsLeft: number;
  countdownLabel: string;
  expired: boolean;
};

export function useBookingLock(tripId?: string | null) {
  const [state, setState] = useState<LockState>({
    lock: null,
    valid: null,
    secondsLeft: 0,
    countdownLabel: '0:00',
    expired: false,
  });

  const validateLock = useCallback(async (lock: BookingLockSession) => {
    const token = getAccessToken();
    if (!token) return false;

    const res = await fetch(
      `${API_BASE}/bookings/locks/validate?lockToken=${encodeURIComponent(lock.lockToken)}&tripId=${encodeURIComponent(lock.tripId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.valid) return false;

    const refreshed: BookingLockSession = {
      ...lock,
      seatIds: data.seatIds ?? lock.seatIds,
      expiresAt: data.expiresAt ?? lock.expiresAt,
    };
    writeBookingLock(refreshed);
    return refreshed;
  }, []);

  useEffect(() => {
    const lock = readBookingLock();
    if (!lock) {
      setState({
        lock: null,
        valid: false,
        secondsLeft: 0,
        countdownLabel: '0:00',
        expired: true,
      });
      return;
    }

    if (tripId && lock.tripId !== tripId) {
      setState({
        lock,
        valid: false,
        secondsLeft: 0,
        countdownLabel: '0:00',
        expired: true,
      });
      return;
    }

    let cancelled = false;

    async function init() {
      const left = secondsUntil(lock!.expiresAt);
      if (left <= 0) {
        clearBookingLock();
        if (!cancelled) {
          setState({
            lock: null,
            valid: false,
            secondsLeft: 0,
            countdownLabel: '0:00',
            expired: true,
          });
        }
        return;
      }

      const refreshed = await validateLock(lock!);
      if (cancelled) return;

      if (!refreshed) {
        clearBookingLock();
        setState({
          lock: null,
          valid: false,
          secondsLeft: 0,
          countdownLabel: '0:00',
          expired: true,
        });
        return;
      }

      const secs = secondsUntil(refreshed.expiresAt);
      setState({
        lock: refreshed,
        valid: true,
        secondsLeft: secs,
        countdownLabel: formatCountdown(secs),
        expired: secs <= 0,
      });
    }

    init();

    const tick = setInterval(() => {
      const current = readBookingLock();
      if (!current) {
        setState((prev) => ({ ...prev, valid: false, expired: true, secondsLeft: 0, countdownLabel: '0:00' }));
        return;
      }
      const secs = secondsUntil(current.expiresAt);
      if (secs <= 0) {
        clearBookingLock();
        setState({
          lock: null,
          valid: false,
          secondsLeft: 0,
          countdownLabel: '0:00',
          expired: true,
        });
        return;
      }
      setState((prev) => ({
        ...prev,
        lock: current,
        valid: true,
        secondsLeft: secs,
        countdownLabel: formatCountdown(secs),
        expired: false,
      }));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [tripId, validateLock]);

  return state;
}
