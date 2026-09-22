'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fareForSegment,
  fetchRouteById,
  type PublicRouteDetail,
  type PublicRouteStop,
} from '@/lib/routes-api';
import { patchBookingLock } from '@/lib/booking-session';

type Props = {
  routeId: string;
  initialBoardingSequence: number;
  initialDroppingSequence: number;
  onChange: (value: {
    boardingSequence: number;
    droppingSequence: number;
    fromCity: string;
    toCity: string;
    boardingStopName: string;
    droppingStopName: string;
    fare: number;
  }) => void;
};

export function StopPicker({
  routeId,
  initialBoardingSequence,
  initialDroppingSequence,
  onChange,
}: Props) {
  const [route, setRoute] = useState<PublicRouteDetail | null>(null);
  const [boardingSequence, setBoardingSequence] = useState(initialBoardingSequence);
  const [droppingSequence, setDroppingSequence] = useState(initialDroppingSequence);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRouteById(routeId)
      .then((r) => {
        setRoute(r);
        setLoading(false);
        if (r) emit(initialBoardingSequence, initialDroppingSequence, r);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial segment only
  }, [routeId]);

  const stops = route?.stops ?? [];

  const boardingOptions = useMemo(
    () => stops.filter((s) => s.sequence < droppingSequence),
    [stops, droppingSequence],
  );

  const droppingOptions = useMemo(
    () => stops.filter((s) => s.sequence > boardingSequence),
    [stops, boardingSequence],
  );

  function emit(boarding: number, dropping: number, routeData: PublicRouteDetail) {
    const boardingStop = routeData.stops.find((s) => s.sequence === boarding);
    const droppingStop = routeData.stops.find((s) => s.sequence === dropping);
    if (!boardingStop || !droppingStop) return;

    const fare = fareForSegment(routeData, boarding, dropping) ?? 0;
    patchBookingLock({
      boardingSequence: boarding,
      droppingSequence: dropping,
      fromCity: boardingStop.city,
      toCity: droppingStop.city,
      boardingStopName: boardingStop.name,
      droppingStopName: droppingStop.name,
      fare,
    });

    onChange({
      boardingSequence: boarding,
      droppingSequence: dropping,
      fromCity: boardingStop.city,
      toCity: droppingStop.city,
      boardingStopName: boardingStop.name,
      droppingStopName: droppingStop.name,
      fare,
    });
  }

  function onBoardingChange(seq: number) {
    setBoardingSequence(seq);
    if (route && seq >= droppingSequence) {
      const nextDrop = route.stops.find((s) => s.sequence > seq);
      if (nextDrop) {
        setDroppingSequence(nextDrop.sequence);
        emit(seq, nextDrop.sequence, route);
        return;
      }
    }
    if (route) emit(seq, droppingSequence, route);
  }

  function onDroppingChange(seq: number) {
    setDroppingSequence(seq);
    if (route) emit(boardingSequence, seq, route);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading stops…</p>;
  }

  if (!route || stops.length < 2) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-sm font-medium text-charcoal">Boarding & dropping points</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Boarding at
          <select
            value={boardingSequence}
            onChange={(e) => onBoardingChange(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            {boardingOptions.map((stop: PublicRouteStop) => (
              <option key={stop.sequence} value={stop.sequence}>
                {stopLabel(stop)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Dropping at
          <select
            value={droppingSequence}
            onChange={(e) => onDroppingChange(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            {droppingOptions.map((stop: PublicRouteStop) => (
              <option key={stop.sequence} value={stop.sequence}>
                {stopLabel(stop)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function stopLabel(stop: PublicRouteStop) {
  return stop.city && stop.city !== stop.name ? `${stop.city} — ${stop.name}` : stop.name;
}
