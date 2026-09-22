'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getAccessToken } from '@/lib/api-client';
import {
  adminFetch,
  type AdminAgent,
  type AdminBus,
  type AdminBusCrew,
  type AdminBusType,
  type AdminCoupon,
  type AdminFareRule,
  type AdminRouteManagement,
  type AdminSettings,
  type AdminTrip,
  type AdminTripSeatPricing,
} from '@/lib/admin-api';

type Tab = 'routes' | 'crew' | 'coupons' | 'fares' | 'discounts' | 'agents';

type RouteRow = {
  id: string;
  name: string;
  code: string;
  routeStops: { sequence: number; stop: { city: string | null; name: string } }[];
};

type StopDraft = {
  stopName: string;
  city: string;
  state: string;
  arrivalOffsetMin: string;
  departureOffsetMin: string;
  distanceFromOriginKm: string;
};

function emptyStop(sequence: number): StopDraft {
  return {
    stopName: '',
    city: '',
    state: sequence <= 2 ? 'Odisha' : '',
    arrivalOffsetMin: sequence === 1 ? '0' : '',
    departureOffsetMin: sequence === 1 ? '0' : '',
    distanceFromOriginKm: sequence === 1 ? '0' : '',
  };
}

function suggestSegmentFare(
  fromSeq: number,
  toSeq: number,
  baseFare: number,
  stops: StopDraft[],
): number {
  const totalDist = Number(stops[stops.length - 1]?.distanceFromOriginKm) || 1;
  const fromDist = Number(stops[fromSeq - 1]?.distanceFromOriginKm ?? 0);
  const toDist = Number(stops[toSeq - 1]?.distanceFromOriginKm ?? 0);
  if (toDist <= fromDist) return baseFare;
  return Math.max(1, Math.round((baseFare * (toDist - fromDist)) / totalDist));
}

export default function AdminOperationsPage() {
  const token = typeof window !== 'undefined' ? getAccessToken() : null;
  const [tab, setTab] = useState<Tab>('routes');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routeManagement, setRouteManagement] = useState<AdminRouteManagement[]>([]);
  const [buses, setBuses] = useState<AdminBus[]>([]);
  const [busCrew, setBusCrew] = useState<AdminBusCrew[]>([]);
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const [crewDraft, setCrewDraft] = useState({
    driver1Name: '',
    driver2Name: '',
    conductorName: '',
  });
  const [busTypes, setBusTypes] = useState<AdminBusType[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [fares, setFares] = useState<AdminFareRule[]>([]);

  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'PERCENT',
    discountValue: '10',
    description: '',
    minOrderAmount: '200',
  });
  const [fareForm, setFareForm] = useState({ fromSequence: '1', toSequence: '2', amount: '1400' });
  const [selectedTripId, setSelectedTripId] = useState('');
  const [tripPricing, setTripPricing] = useState<AdminTripSeatPricing | null>(null);
  const [seatPriceDrafts, setSeatPriceDrafts] = useState<Record<string, string>>({});
  const [bulkSeatPrice, setBulkSeatPrice] = useState('500');
  const [agentForm, setAgentForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    employeeCode: '',
    salaryMonthly: '15000',
    commissionRatePercent: '3',
  });
  const [assignForms, setAssignForms] = useState<
    Record<string, { busId: string; departureTime: string }>
  >({});
  const [routeFormMode, setRouteFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [editOriginalStopCount, setEditOriginalStopCount] = useState(0);
  const [createRouteForm, setCreateRouteForm] = useState({
    code: '',
    name: '',
    baseFare: '1200',
    isActive: true,
    departureTime: '06:00',
    assignBus: true,
    busMode: 'existing' as 'existing' | 'new',
    busId: '',
    registrationNumber: '',
    busName: '',
    busTypeId: '',
  });
  const [stopDrafts, setStopDrafts] = useState<StopDraft[]>([emptyStop(1), emptyStop(2)]);
  const [segmentFareDrafts, setSegmentFareDrafts] = useState<Record<string, string>>({});
  const [newBusForm, setNewBusForm] = useState({
    registrationNumber: '',
    name: '',
    busTypeId: '',
  });
  const [cancelDayForm, setCancelDayForm] = useState({
    routeId: '',
    serviceDate: new Date().toISOString().slice(0, 10),
    reason: '',
    refundPassengers: true,
  });

  const reload = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [c, a, r, rm, b, crew, bt, t, s] = await Promise.all([
        adminFetch<AdminCoupon[]>(token, '/admin/coupons'),
        adminFetch<AdminAgent[]>(token, '/admin/agents'),
        adminFetch<RouteRow[]>(token, '/admin/routes'),
        adminFetch<AdminRouteManagement[]>(token, '/admin/routes/management'),
        adminFetch<AdminBus[]>(token, '/admin/buses'),
        adminFetch<AdminBusCrew[]>(token, '/admin/buses/crew'),
        adminFetch<AdminBusType[]>(token, '/admin/bus-types'),
        adminFetch<AdminTrip[]>(token, '/admin/trips?days=21'),
        adminFetch<AdminSettings>(token, '/admin/settings'),
      ]);
      setCoupons(c);
      setAgents(a);
      setRoutes(r);
      setRouteManagement(rm);
      setBuses(b);
      setBusCrew(crew);
      setBusTypes(bt);
      setTrips(t);
      setSettings(s);
      if (!createRouteForm.busTypeId && bt.length) {
        setCreateRouteForm((prev) => ({ ...prev, busTypeId: bt[0].id }));
      }
      if (!selectedRouteId && r.length) setSelectedRouteId(r[0].id);
      if (!cancelDayForm.routeId && r.length) {
        setCancelDayForm((prev) => ({ ...prev, routeId: r[0].id }));
      }
      if (!newBusForm.busTypeId && bt.length) {
        setNewBusForm((prev) => ({ ...prev, busTypeId: bt[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }, [token, selectedRouteId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!token || !selectedRouteId) return;
    adminFetch<AdminFareRule[]>(token, `/admin/routes/${selectedRouteId}/fares`)
      .then((rules) => {
        setFares(rules);
        const route = routes.find((r) => r.id === selectedRouteId);
        if (!route?.routeStops.length) return;
        const sorted = [...route.routeStops].sort((a, b) => a.sequence - b.sequence);
        const firstSeq = sorted[0]?.sequence ?? 1;
        const lastSeq = sorted[sorted.length - 1]?.sequence ?? 2;
        const fullRouteFare = rules.find(
          (f) => f.fromSequence === firstSeq && f.toSequence === lastSeq,
        );
        setFareForm({
          fromSequence: String(firstSeq),
          toSequence: String(lastSeq),
          amount: fullRouteFare ? String(Number(fullRouteFare.amount)) : '1400',
        });
      })
      .catch(() => setFares([]));
  }, [token, selectedRouteId, routes]);

  function resetRouteForm() {
    setRouteFormMode('closed');
    setEditRouteId(null);
    setEditOriginalStopCount(0);
    setCreateRouteForm({
      code: '',
      name: '',
      baseFare: '1200',
      isActive: true,
      departureTime: '06:00',
      assignBus: true,
      busMode: 'existing',
      busId: '',
      registrationNumber: '',
      busName: '',
      busTypeId: busTypes[0]?.id ?? '',
    });
    setStopDrafts([emptyStop(1), emptyStop(2)]);
    setSegmentFareDrafts({});
  }

  function openCreateRouteForm() {
    resetRouteForm();
    setRouteFormMode('create');
  }

  function formatDepartureTime(iso: string) {
    const d = new Date(iso);
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function activeSchedule(route: AdminRouteManagement) {
    return route.schedules.find((s) => s.isActive);
  }

  function activeSchedules(route: AdminRouteManagement) {
    return route.schedules.filter((s) => s.isActive);
  }

  function latestSchedule(route: AdminRouteManagement) {
    return route.schedules[0];
  }

  function busRouteAssignment(busId: string) {
    for (const route of routeManagement) {
      const active = route.schedules.find((s) => s.isActive && s.bus.id === busId);
      if (active && route.isActive) {
        return { route, running: true as const };
      }
    }
    for (const route of routeManagement) {
      const linked = route.schedules.find((s) => s.bus.id === busId);
      if (linked && !route.isActive) {
        return { route, running: false as const };
      }
    }
    return null;
  }

  function busAvailableForRoute(busId: string, routeId: string) {
    for (const route of routeManagement) {
      if (route.id === routeId || !route.isActive) continue;
      const active = route.schedules.find((s) => s.isActive && s.bus.id === busId);
      if (active) return false;
    }
    return true;
  }

  async function openEditRoute(route: AdminRouteManagement) {
    const authToken = getAccessToken();
    if (!authToken) {
      setError('Please sign in as admin to edit routes.');
      return;
    }
    setError(null);
    setMessage(null);

    try {
      const schedule = latestSchedule(route);
      const runningSchedule = activeSchedule(route);
      const sortedStops = [...route.routeStops].sort((a, b) => a.sequence - b.sequence);

      let fares: AdminFareRule[] = [];
      try {
        fares = await adminFetch<AdminFareRule[]>(authToken, `/admin/routes/${route.id}/fares`);
      } catch {
        fares = [];
      }

      const firstSeq = sortedStops[0]?.sequence;
      const lastSeq = sortedStops[sortedStops.length - 1]?.sequence;
      const fullFare = fares.find(
        (f) => f.fromSequence === firstSeq && f.toSequence === lastSeq,
      );

      const segmentDrafts: Record<string, string> = {};
      for (const fare of fares) {
        segmentDrafts[`${fare.fromSequence}-${fare.toSequence}`] = String(Number(fare.amount));
      }

      type RouteStopRow = AdminRouteManagement['routeStops'][number] & {
        arrivalOffsetMin?: number;
        departureOffsetMin?: number;
        distanceFromOriginKm?: number | string;
        stop: { name: string; city: string | null; state?: string | null };
      };

      setEditRouteId(route.id);
      setEditOriginalStopCount(sortedStops.length);
      setRouteFormMode('edit');
      setCreateRouteForm({
        code: route.code,
        name: route.name,
        baseFare: fullFare ? String(Number(fullFare.amount)) : '1200',
        isActive: route.isActive,
        departureTime: schedule?.departureTime
          ? formatDepartureTime(schedule.departureTime)
          : '06:00',
        assignBus: Boolean(runningSchedule?.bus?.id),
        busMode: 'existing',
        busId: runningSchedule?.bus?.id ?? '',
        registrationNumber: '',
        busName: '',
        busTypeId: busTypes[0]?.id ?? '',
      });
      setStopDrafts(
        (sortedStops as RouteStopRow[]).map((rs) => ({
          stopName: rs.stop.name,
          city: rs.stop.city ?? '',
          state: rs.stop.state ?? '',
          arrivalOffsetMin: String(rs.arrivalOffsetMin ?? 0),
          departureOffsetMin: String(rs.departureOffsetMin ?? rs.arrivalOffsetMin ?? 0),
          distanceFromOriginKm: String(Number(rs.distanceFromOriginKm ?? 0)),
        })),
      );
      setSegmentFareDrafts(segmentDrafts);

      requestAnimationFrame(() => {
        document.getElementById('route-editor-form')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load route for editing');
    }
  }

  async function onCreateCoupon(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setMessage(null);
    try {
      await adminFetch(token, '/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponForm.code,
          discountType: couponForm.discountType,
          discountValue: Number(couponForm.discountValue),
          description: couponForm.description || undefined,
          minOrderAmount: Number(couponForm.minOrderAmount),
        }),
      });
      setMessage(`Coupon ${couponForm.code.toUpperCase()} created`);
      setCouponForm({ ...couponForm, code: '', description: '' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onDeleteCoupon(id: string, code: string) {
    if (!token || !window.confirm(`Remove coupon ${code}?`)) return;
    try {
      await adminFetch(token, `/admin/coupons/${id}`, { method: 'DELETE' });
      setMessage(`Coupon ${code} removed`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onSaveFare(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedRouteId) return;
    try {
      await adminFetch(token, `/admin/routes/${selectedRouteId}/fares`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSequence: Number(fareForm.fromSequence),
          toSequence: Number(fareForm.toSequence),
          amount: Number(fareForm.amount),
        }),
      });
      setMessage('Fare updated — applies to all trips on this route segment');
      const next = await adminFetch<AdminFareRule[]>(token, `/admin/routes/${selectedRouteId}/fares`);
      setFares(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onDeleteFare(fromSequence: number, toSequence: number) {
    if (!token || !selectedRouteId) return;
    if (!window.confirm(`Remove fare ${fromSequence}→${toSequence}?`)) return;
    await adminFetch(
      token,
      `/admin/routes/${selectedRouteId}/fares/${fromSequence}/${toSequence}`,
      { method: 'DELETE' },
    );
    setMessage('Fare removed');
    const next = await adminFetch<AdminFareRule[]>(token, `/admin/routes/${selectedRouteId}/fares`);
    setFares(next);
  }

  async function loadTripPricing(tripId: string) {
    if (!token || !tripId) return;
    setError(null);
    try {
      const data = await adminFetch<AdminTripSeatPricing>(
        token,
        `/admin/trips/${tripId}/seat-pricing?fromSequence=${fareForm.fromSequence}&toSequence=${fareForm.toSequence}`,
      );
      setTripPricing(data);
      const drafts: Record<string, string> = {};
      for (const seat of data.seats) {
        if (seat.status === 'available') {
          drafts[seat.id] = seat.overrideAmount != null ? String(seat.overrideAmount) : '';
        }
      }
      setSeatPriceDrafts(drafts);
    } catch (err) {
      setTripPricing(null);
      setError(err instanceof Error ? err.message : 'Could not load trip seats');
    }
  }

  async function onSaveSeatOverride(busSeatId: string) {
    if (!token || !selectedTripId || !tripPricing) return;
    const amount = Number(seatPriceDrafts[busSeatId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid price for this seat');
      return;
    }
    try {
      const data = await adminFetch<AdminTripSeatPricing>(token, `/admin/trips/${selectedTripId}/seat-pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSequence: Number(fareForm.fromSequence),
          toSequence: Number(fareForm.toSequence),
          overrides: [{ busSeatId, amount }],
        }),
      });
      setTripPricing(data);
      setMessage(`Seat price updated to ₹${amount}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save seat price');
    }
  }

  async function onClearSeatOverride(busSeatId: string) {
    if (!token || !selectedTripId) return;
    try {
      const data = await adminFetch<AdminTripSeatPricing>(
        token,
        `/admin/trips/${selectedTripId}/seat-pricing/${busSeatId}?fromSequence=${fareForm.fromSequence}&toSequence=${fareForm.toSequence}`,
        { method: 'DELETE' },
      );
      setTripPricing(data);
      setSeatPriceDrafts((prev) => ({ ...prev, [busSeatId]: '' }));
      setMessage('Seat price reset to base fare');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear seat price');
    }
  }

  async function onBulkApplySeatPrices() {
    if (!token || !selectedTripId || !tripPricing) return;
    const amount = Number(bulkSeatPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid bulk price');
      return;
    }
    const availableSeats = tripPricing.seats.filter((s) => s.status === 'available');
    if (!availableSeats.length) {
      setError('No available seats to discount on this trip');
      return;
    }
    try {
      const data = await adminFetch<AdminTripSeatPricing>(token, `/admin/trips/${selectedTripId}/seat-pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSequence: Number(fareForm.fromSequence),
          toSequence: Number(fareForm.toSequence),
          overrides: availableSeats.map((seat) => ({ busSeatId: seat.id, amount })),
        }),
      });
      setTripPricing(data);
      const drafts: Record<string, string> = {};
      for (const seat of data.seats) {
        if (seat.status === 'available') {
          drafts[seat.id] = seat.overrideAmount != null ? String(seat.overrideAmount) : '';
        }
      }
      setSeatPriceDrafts(drafts);
      setMessage(`Applied ₹${amount} to ${availableSeats.length} available seats`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    }
  }

  async function onSaveDiscounts(e: FormEvent) {
    e.preventDefault();
    if (!token || !settings) return;
    try {
      await adminFetch(token, '/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setMessage('Discount settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onCreateAgent(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await adminFetch(token, '/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: agentForm.fullName,
          email: agentForm.email,
          password: agentForm.password,
          phone: agentForm.phone,
          employeeCode: agentForm.employeeCode,
          salaryMonthly: Number(agentForm.salaryMonthly),
          commissionRatePercent: Number(agentForm.commissionRatePercent),
        }),
      });
      setMessage(`Agent ${agentForm.fullName} created`);
      setAgentForm({ ...agentForm, fullName: '', email: '', phone: '', employeeCode: '' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onDeactivateAgent(id: string, name: string) {
    if (!token || !window.confirm(`Deactivate agent ${name}? They will not be able to log in.`)) return;
    await adminFetch(token, `/admin/agents/${id}`, { method: 'DELETE' });
    setMessage(`Agent ${name} deactivated`);
    await reload();
  }

  async function onToggleRoute(routeId: string, isActive: boolean, routeName: string) {
    if (!token) return;
    const action = isActive ? 'disable' : 'enable';
    if (
      !window.confirm(
        `${action === 'disable' ? 'Stop' : 'Start'} running route "${routeName}"? ${
          action === 'disable'
            ? 'Customers will no longer see this route in search.'
            : 'Assign a bus below before customers can book.'
        }`,
      )
    ) {
      return;
    }
    try {
      await adminFetch(token, `/admin/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setMessage(`Route ${routeName} ${action === 'disable' ? 'disabled' : 'enabled'}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update route');
    }
  }

  async function onAssignBus(routeId: string, routeName: string) {
    if (!token) return;
    const form = assignForms[routeId] ?? { busId: '', departureTime: '06:00' };
    if (!form.busId) {
      setError('Select a bus number to assign');
      return;
    }
    try {
      await adminFetch(token, `/admin/routes/${routeId}/assign-bus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: form.busId,
          departureTime: form.departureTime,
        }),
      });
      setMessage(`Bus assigned to ${routeName}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign bus');
    }
  }

  async function onCreateBus(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!newBusForm.registrationNumber.trim() || !newBusForm.busTypeId) {
      setError('Enter bus registration number and select a bus type');
      return;
    }
    try {
      await adminFetch(token, '/admin/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationNumber: newBusForm.registrationNumber.trim().toUpperCase(),
          name: newBusForm.name.trim() || newBusForm.registrationNumber.trim(),
          busTypeId: newBusForm.busTypeId,
        }),
      });
      setMessage(`Bus ${newBusForm.registrationNumber.trim().toUpperCase()} added to fleet`);
      setNewBusForm({
        registrationNumber: '',
        name: '',
        busTypeId: busTypes[0]?.id ?? newBusForm.busTypeId,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bus');
    }
  }

  async function onCancelRouteDay(e: FormEvent) {
    e.preventDefault();
    if (!token || !cancelDayForm.routeId) return;
    const route = routes.find((r) => r.id === cancelDayForm.routeId);
    const label = route?.code ?? 'route';
    if (
      !window.confirm(
        `Cancel all ${label} trips on ${cancelDayForm.serviceDate}?${
          cancelDayForm.refundPassengers
            ? ' Passengers with bookings will be cancelled and refunded.'
            : ''
        }`,
      )
    ) {
      return;
    }
    try {
      const data = await adminFetch<{ cancelledCount: number; serviceDate: string }>(
        token,
        `/admin/routes/${cancelDayForm.routeId}/cancel-date`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceDate: cancelDayForm.serviceDate,
            reason: cancelDayForm.reason.trim() || undefined,
            refundPassengers: cancelDayForm.refundPassengers,
          }),
        },
      );
      setMessage(
        `Cancelled ${data.cancelledCount} trip(s) for ${label} on ${data.serviceDate}`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel trips for that day');
    }
  }

  async function onRestoreRouteDay(e: FormEvent) {
    e.preventDefault();
    if (!token || !cancelDayForm.routeId) return;
    const route = routes.find((r) => r.id === cancelDayForm.routeId);
    const label = route?.code ?? 'route';
    if (
      !window.confirm(
        `Restore ${label} trips on ${cancelDayForm.serviceDate}? The route will be bookable again for that day. Previously refunded bookings are not reinstated.`,
      )
    ) {
      return;
    }
    try {
      const data = await adminFetch<{ restoredCount: number; serviceDate: string }>(
        token,
        `/admin/routes/${cancelDayForm.routeId}/restore-date`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceDate: cancelDayForm.serviceDate }),
        },
      );
      setMessage(
        `Restored ${data.restoredCount} trip(s) for ${label} on ${data.serviceDate}`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore trips for that day');
    }
  }

  async function onRestoreTrip(tripId: string, routeCode: string, serviceDate: string) {
    if (!token) return;
    if (
      !window.confirm(
        `Restore ${routeCode} on ${serviceDate}? Passengers who were refunded must book again manually.`,
      )
    ) {
      return;
    }
    try {
      await adminFetch(token, `/admin/trips/${tripId}/restore`, { method: 'PATCH' });
      setMessage(`Trip restored for ${routeCode} on ${serviceDate}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore trip');
    }
  }

  async function onCancelTrip(tripId: string, routeCode: string, serviceDate: string) {
    if (!token) return;
    if (
      !window.confirm(
        `Cancel ${routeCode} on ${serviceDate}? Passengers with bookings will be refunded.`,
      )
    ) {
      return;
    }
    try {
      await adminFetch(token, `/admin/trips/${tripId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundPassengers: true,
          reason: cancelDayForm.reason.trim() || 'Cancelled from admin operations',
        }),
      });
      setMessage(`Trip cancelled for ${routeCode} on ${serviceDate}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel trip');
    }
  }

  function segmentPairs(count: number) {
    const pairs: { from: number; to: number; key: string }[] = [];
    for (let i = 1; i <= count; i++) {
      for (let j = i + 1; j <= count; j++) {
        pairs.push({ from: i, to: j, key: `${i}-${j}` });
      }
    }
    return pairs;
  }

  async function onSaveRoute(e: FormEvent) {
    e.preventDefault();
    const authToken = getAccessToken();
    if (!authToken) {
      setError('Please sign in as admin to save routes.');
      return;
    }
    setError(null);
    setMessage(null);

    const baseFare = Number(createRouteForm.baseFare);
    if (routeFormMode === 'create' && !createRouteForm.code.trim()) {
      setError('Route code is required');
      return;
    }
    if (!createRouteForm.name.trim()) {
      setError('Route name is required');
      return;
    }
    if (!Number.isFinite(baseFare) || baseFare <= 0) {
      setError('Enter a valid full-route fare');
      return;
    }
    if (stopDrafts.some((s) => !s.city.trim() || !s.stopName.trim())) {
      setError('Each stop needs a city and stop name');
      return;
    }

    const segmentFares = segmentPairs(stopDrafts.length)
      .map(({ from, to, key }) => {
        const amount = Number(segmentFareDrafts[key]);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return { fromSequence: from, toSequence: to, amount };
      })
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: createRouteForm.name.trim(),
      baseFare,
      isActive: createRouteForm.isActive,
      stops: stopDrafts.map((stop, idx) => ({
        stopName: stop.stopName.trim(),
        city: stop.city.trim(),
        state: stop.state.trim() || undefined,
        sequence: idx + 1,
        arrivalOffsetMin: Number(stop.arrivalOffsetMin || 0),
        departureOffsetMin: Number(stop.departureOffsetMin || stop.arrivalOffsetMin || 0),
        distanceFromOriginKm: Number(stop.distanceFromOriginKm || 0),
      })),
      segmentFares,
    };

    if (routeFormMode === 'create') {
      payload.code = createRouteForm.code.trim().toUpperCase();
    }

    if (createRouteForm.assignBus) {
      payload.departureTime = createRouteForm.departureTime;
      if (createRouteForm.busMode === 'existing') {
        if (!createRouteForm.busId) {
          setError('Select a bus or switch to register a new bus number');
          return;
        }
        payload.bus = { busId: createRouteForm.busId };
      } else if (createRouteForm.registrationNumber.trim()) {
        payload.bus = {
          registrationNumber: createRouteForm.registrationNumber.trim().toUpperCase(),
          name: createRouteForm.busName.trim() || undefined,
          busTypeId: createRouteForm.busTypeId || undefined,
        };
      } else if (createRouteForm.busId) {
        payload.bus = { busId: createRouteForm.busId };
      }
    }

    try {
      if (routeFormMode === 'edit' && editRouteId) {
        await adminFetch(authToken, `/admin/routes/${editRouteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setMessage(`Route ${createRouteForm.code} updated`);
      } else {
        await adminFetch(authToken, '/admin/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setMessage(`Route ${createRouteForm.code.toUpperCase()} created`);
      }
      resetRouteForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save route');
    }
  }

  async function onToggleAgent(id: string, isActive: boolean) {
    if (!token) return;
    await adminFetch(token, `/admin/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await reload();
  }

  function startEditCrew(bus: AdminBusCrew) {
    setEditingCrewId(bus.id);
    setCrewDraft({
      driver1Name: bus.driver1Name ?? '',
      driver2Name: bus.driver2Name ?? '',
      conductorName: bus.conductorName ?? '',
    });
  }

  async function onSaveCrew(busId: string) {
    const authToken = getAccessToken();
    if (!authToken) {
      setError('Please sign in as admin to save crew details.');
      return;
    }
    setError(null);
    try {
      await adminFetch(authToken, `/admin/buses/${busId}/crew`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver1Name: crewDraft.driver1Name.trim() || null,
          driver2Name: crewDraft.driver2Name.trim() || null,
          conductorName: crewDraft.conductorName.trim() || null,
        }),
      });
      setMessage('Bus crew updated');
      setEditingCrewId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save crew');
    }
  }

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'routes', label: 'Routes & buses' },
    { id: 'crew', label: 'Bus crew' },
    { id: 'coupons', label: 'Coupons' },
    { id: 'fares', label: 'Seat prices' },
    { id: 'discounts', label: 'Discounts' },
    { id: 'agents', label: 'Agents' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <nav className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-2 text-sm sm:px-6">
          <Link href="/admin" className="text-gray-600 hover:text-brand">
            Dashboard
          </Link>
          <span className="font-medium text-brand">Operations</span>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-charcoal">Admin operations</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage routes, bus assignments, crew, coupons, fares, discounts, and agent accounts
        </p>

        {message && (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                tab === t.id ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'routes' && (
          <div className="mt-6 space-y-6">
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-charcoal">Route operations</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Create new routes with stops and fares, then assign a bus by registration number.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    routeFormMode === 'closed' ? openCreateRouteForm() : resetRouteForm()
                  }
                >
                  {routeFormMode === 'closed' ? '+ Create new route' : 'Close form'}
                </button>
              </div>
            </section>

            {routeFormMode !== 'closed' && (
              <section id="route-editor-form" className="card border border-brand/20">
                <h2 className="font-semibold text-charcoal">
                  {routeFormMode === 'edit' ? `Edit route — ${createRouteForm.code}` : 'New route'}
                </h2>
                {routeFormMode === 'edit' && (
                  <p className="mt-1 text-xs text-amber-700">
                    You can add new stops at the end of the route. Removing or reordering existing
                    stops is blocked once this route has bookings.
                  </p>
                )}
                <form className="mt-4 space-y-6 text-sm" onSubmit={onSaveRoute}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block">
                      Route code
                      <input
                        required={routeFormMode === 'create'}
                        readOnly={routeFormMode === 'edit'}
                        placeholder="e.g. JRG-BLR"
                        className={`mt-1 w-full rounded border px-3 py-2 uppercase ${
                          routeFormMode === 'edit' ? 'bg-gray-100 text-gray-600' : ''
                        }`}
                        value={createRouteForm.code}
                        onChange={(e) =>
                          setCreateRouteForm({ ...createRouteForm, code: e.target.value.toUpperCase() })
                        }
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      Route name
                      <input
                        required
                        placeholder="e.g. Jharsuguda – Bangalore"
                        className="mt-1 w-full rounded border px-3 py-2"
                        value={createRouteForm.name}
                        onChange={(e) =>
                          setCreateRouteForm({ ...createRouteForm, name: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      Full-route fare (₹)
                      <input
                        required
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded border px-3 py-2"
                        value={createRouteForm.baseFare}
                        onChange={(e) =>
                          setCreateRouteForm({ ...createRouteForm, baseFare: e.target.value })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        checked={createRouteForm.isActive}
                        onChange={(e) =>
                          setCreateRouteForm({ ...createRouteForm, isActive: e.target.checked })
                        }
                      />
                      Start route immediately (visible in search)
                    </label>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium text-charcoal">Stopping locations</h3>
                      <button
                        type="button"
                        className="text-xs font-medium text-brand hover:underline"
                        onClick={() => setStopDrafts((prev) => [...prev, emptyStop(prev.length + 1)])}
                      >
                        + Add stop
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Stops are ordered 1 → 2 → 3. Times and distance are from route origin (first
                      stop).
                    </p>
                    <div className="mt-3 space-y-3">
                      {stopDrafts.map((stop, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-gray-100 bg-gray-50/80 p-3"
                        >
                          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                            Stop {idx + 1}
                            {idx === 0 && ' (origin)'}
                            {idx === stopDrafts.length - 1 && stopDrafts.length > 1 && ' (destination)'}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <input
                              required
                              placeholder="City (search name)"
                              className="rounded border px-3 py-2"
                              value={stop.city}
                              onChange={(e) => {
                                const next = [...stopDrafts];
                                next[idx] = { ...next[idx], city: e.target.value };
                                setStopDrafts(next);
                              }}
                            />
                            <input
                              required
                              placeholder="Stop name e.g. ISBT"
                              className="rounded border px-3 py-2 sm:col-span-2"
                              value={stop.stopName}
                              onChange={(e) => {
                                const next = [...stopDrafts];
                                next[idx] = { ...next[idx], stopName: e.target.value };
                                setStopDrafts(next);
                              }}
                            />
                            <input
                              placeholder="State"
                              className="rounded border px-3 py-2"
                              value={stop.state}
                              onChange={(e) => {
                                const next = [...stopDrafts];
                                next[idx] = { ...next[idx], state: e.target.value };
                                setStopDrafts(next);
                              }}
                            />
                            <input
                              type="number"
                              min={0}
                              placeholder="Arrival min"
                              className="rounded border px-3 py-2"
                              value={stop.arrivalOffsetMin}
                              onChange={(e) => {
                                const next = [...stopDrafts];
                                next[idx] = { ...next[idx], arrivalOffsetMin: e.target.value };
                                setStopDrafts(next);
                              }}
                            />
                            <input
                              type="number"
                              min={0}
                              placeholder="Departure min"
                              className="rounded border px-3 py-2"
                              value={stop.departureOffsetMin}
                              onChange={(e) => {
                                const next = [...stopDrafts];
                                next[idx] = { ...next[idx], departureOffsetMin: e.target.value };
                                setStopDrafts(next);
                              }}
                            />
                            <input
                              type="number"
                              min={0}
                              placeholder="Distance km from origin"
                              className="rounded border px-3 py-2"
                              value={stop.distanceFromOriginKm}
                              onChange={(e) => {
                                const next = [...stopDrafts];
                                next[idx] = { ...next[idx], distanceFromOriginKm: e.target.value };
                                setStopDrafts(next);
                              }}
                            />
                          </div>
                          {(() => {
                            const canRemove =
                              stopDrafts.length > 2 &&
                              idx > 0 &&
                              (routeFormMode !== 'edit'
                                ? idx < stopDrafts.length - 1
                                : idx >= editOriginalStopCount);
                            return canRemove ? (
                            <button
                              type="button"
                              className="mt-2 text-xs text-red-600 hover:underline"
                              onClick={() =>
                                setStopDrafts((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              Remove stop
                            </button>
                            ) : null;
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>

                  {stopDrafts.length >= 2 && (
                    <div>
                      <h3 className="font-medium text-charcoal">Segment fares (optional)</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Leave blank to auto-calculate from distance. Override specific segments below.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {segmentPairs(stopDrafts.length).map(({ from, to, key }) => {
                          const suggested = suggestSegmentFare(
                            from,
                            to,
                            Number(createRouteForm.baseFare) || 0,
                            stopDrafts,
                          );
                          const fromCity = stopDrafts[from - 1]?.city || `Stop ${from}`;
                          const toCity = stopDrafts[to - 1]?.city || `Stop ${to}`;
                          return (
                            <label key={key} className="block rounded border border-gray-100 p-2">
                              {fromCity} → {toCity} (₹)
                              <input
                                type="number"
                                min={1}
                                placeholder={`Auto ~${suggested}`}
                                className="mt-1 w-full rounded border px-2 py-1"
                                value={segmentFareDrafts[key] ?? ''}
                                onChange={(e) =>
                                  setSegmentFareDrafts((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-100 p-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createRouteForm.assignBus}
                        onChange={(e) =>
                          setCreateRouteForm({ ...createRouteForm, assignBus: e.target.checked })
                        }
                      />
                      Assign bus now
                    </label>
                    {createRouteForm.assignBus && (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={createRouteForm.busMode === 'existing'}
                              onChange={() =>
                                setCreateRouteForm({ ...createRouteForm, busMode: 'existing' })
                              }
                            />
                            Existing bus
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={createRouteForm.busMode === 'new'}
                              onChange={() =>
                                setCreateRouteForm({ ...createRouteForm, busMode: 'new' })
                              }
                            />
                            Register new bus no.
                          </label>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          {createRouteForm.busMode === 'existing' ? (
                            <label>
                              Bus no.
                              <select
                                className="mt-1 block min-w-[220px] rounded border px-3 py-2"
                                value={createRouteForm.busId}
                                onChange={(e) =>
                                  setCreateRouteForm({ ...createRouteForm, busId: e.target.value })
                                }
                              >
                                <option value="">Select bus…</option>
                                {buses
                                  .filter((b) => b.status === 'ACTIVE')
                                  .map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.registrationNumber}
                                      {b.name ? ` — ${b.name}` : ''}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          ) : (
                            <>
                              <label>
                                Bus no. (registration)
                                <input
                                  className="mt-1 block w-44 rounded border px-3 py-2 uppercase"
                                  placeholder="OD-05-SS-0002"
                                  value={createRouteForm.registrationNumber}
                                  onChange={(e) =>
                                    setCreateRouteForm({
                                      ...createRouteForm,
                                      registrationNumber: e.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Bus name
                                <input
                                  className="mt-1 block w-48 rounded border px-3 py-2"
                                  placeholder="Shiv Shakti Express 2"
                                  value={createRouteForm.busName}
                                  onChange={(e) =>
                                    setCreateRouteForm({
                                      ...createRouteForm,
                                      busName: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Layout
                                <select
                                  className="mt-1 block min-w-[200px] rounded border px-3 py-2"
                                  value={createRouteForm.busTypeId}
                                  onChange={(e) =>
                                    setCreateRouteForm({
                                      ...createRouteForm,
                                      busTypeId: e.target.value,
                                    })
                                  }
                                >
                                  {busTypes.map((bt) => (
                                    <option key={bt.id} value={bt.id}>
                                      {bt.name} ({bt.totalSeats} seats)
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          )}
                          <label>
                            Departure time
                            <input
                              type="time"
                              required={createRouteForm.assignBus}
                              className="mt-1 block rounded border px-3 py-2"
                              value={createRouteForm.departureTime}
                              onChange={(e) =>
                                setCreateRouteForm({
                                  ...createRouteForm,
                                  departureTime: e.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn-primary">
                    {routeFormMode === 'edit' ? 'Save changes' : 'Create route'}
                  </button>
                </form>
              </section>
            )}

            <section className="card">
              <h2 className="font-semibold text-charcoal">Active routes</h2>
              <p className="mt-1 text-xs text-gray-500">
                Enable or disable the Jharsuguda–Bangalore route and change the assigned bus.
              </p>
            </section>

            {routeManagement.map((route) => {
              const schedule = activeSchedule(route);
              const runningSchedules = activeSchedules(route);
              const lastSchedule = latestSchedule(route);
              const assignForm = assignForms[route.id] ?? {
                busId: schedule?.bus?.id ?? '',
                departureTime: schedule?.departureTime
                  ? formatDepartureTime(schedule.departureTime)
                  : lastSchedule?.departureTime
                    ? formatDepartureTime(lastSchedule.departureTime)
                    : '06:00',
              };
              const cities = route.routeStops
                .sort((a, b) => a.sequence - b.sequence)
                .map((rs) => rs.stop.city ?? rs.stop.name)
                .join(' → ');

              return (
                <section
                  key={route.id}
                  className={`card border-l-4 ${route.isActive ? 'border-l-brand' : 'border-l-gray-300 opacity-90'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-charcoal">{route.name}</h3>
                        <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-deep">
                          {route.code}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            route.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {route.isActive ? 'Running' : 'Stopped'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{cities}</p>
                      {runningSchedules.length > 0 && route.isActive && (
                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                          {runningSchedules.map((s) => (
                            <p key={s.id}>
                              Assigned bus:{' '}
                              <strong>{s.bus.registrationNumber}</strong>
                              {s.bus.name ? ` (${s.bus.name})` : ''} · departs{' '}
                              {formatDepartureTime(s.departureTime)}
                            </p>
                          ))}
                        </div>
                      )}
                      {runningSchedules.length === 0 && route.isActive && (
                        <p className="mt-2 text-sm text-amber-700">
                          Route is enabled but no bus assigned — assign one below.
                        </p>
                      )}
                      {!route.isActive && lastSchedule?.bus && (
                        <p className="mt-2 text-sm text-gray-500">
                          Last assigned bus:{' '}
                          <strong>{lastSchedule.bus.registrationNumber}</strong>
                          {lastSchedule.bus.name ? ` (${lastSchedule.bus.name})` : ''} — route stopped,
                          not running
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditRoute(route)}
                        className="rounded-lg border border-brand/30 px-3 py-2 text-sm font-medium text-brand hover:bg-brand-light/40"
                      >
                        Edit route
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleRoute(route.id, route.isActive, route.name)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          route.isActive
                            ? 'border border-red-200 text-red-700 hover:bg-red-50'
                            : 'bg-brand text-white hover:bg-brand-deep'
                        }`}
                      >
                        {route.isActive ? 'Stop route' : 'Start route'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4 text-sm">
                    <label>
                      Bus no.
                      <select
                        className="mt-1 block min-w-[220px] rounded border px-3 py-2"
                        value={assignForm.busId}
                        onChange={(e) =>
                          setAssignForms((prev) => ({
                            ...prev,
                            [route.id]: { ...assignForm, busId: e.target.value },
                          }))
                        }
                      >
                        <option value="">Select bus…</option>
                        {buses
                          .filter(
                            (b) =>
                              b.status === 'ACTIVE' &&
                              (busAvailableForRoute(b.id, route.id) || assignForm.busId === b.id),
                          )
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.registrationNumber}
                              {b.name ? ` — ${b.name}` : ''}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Departure
                      <input
                        type="time"
                        className="mt-1 block rounded border px-3 py-2"
                        value={assignForm.departureTime}
                        onChange={(e) =>
                          setAssignForms((prev) => ({
                            ...prev,
                            [route.id]: { ...assignForm, departureTime: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onAssignBus(route.id, route.name)}
                    >
                      {!route.isActive
                        ? 'Start route & assign bus'
                        : schedule?.isActive
                          ? 'Change bus'
                          : 'Assign bus'}
                    </button>
                  </div>
                </section>
              );
            })}

            {routeManagement.length === 0 && (
              <p className="text-sm text-gray-500">
                No routes in the system yet. Run database seed or add routes via API.
              </p>
            )}

            <section className="card">
              <h2 className="font-semibold text-charcoal">Add bus to fleet</h2>
              <p className="mt-1 text-xs text-gray-500">
                Register a new bus number before assigning it to a route. Seat layout comes from the
                selected bus type.
              </p>
              <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end" onSubmit={onCreateBus}>
                <label className="block text-sm">
                  Registration no.
                  <input
                    required
                    type="text"
                    placeholder="OD-05-SS-0002"
                    className="mt-1 block w-full rounded border px-3 py-2 font-mono uppercase"
                    value={newBusForm.registrationNumber}
                    onChange={(e) =>
                      setNewBusForm((prev) => ({
                        ...prev,
                        registrationNumber: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  Display name
                  <input
                    type="text"
                    placeholder="Shiv Shakti Express 2"
                    className="mt-1 block w-full rounded border px-3 py-2"
                    value={newBusForm.name}
                    onChange={(e) => setNewBusForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  Bus type
                  <select
                    required
                    className="mt-1 block w-full rounded border px-3 py-2"
                    value={newBusForm.busTypeId}
                    onChange={(e) =>
                      setNewBusForm((prev) => ({ ...prev, busTypeId: e.target.value }))
                    }
                  >
                    <option value="">Select type…</option>
                    {busTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name} ({bt.totalSeats} seats)
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary">
                  Add bus
                </button>
              </form>
            </section>

            <section className="card border-amber-200 bg-amber-50/40">
              <h2 className="font-semibold text-charcoal">Cancel route for a day</h2>
              <p className="mt-1 text-xs text-gray-600">
                If a bus breaks down or cannot run, cancel that route for a specific date only. The
                route stays active for other days. Passengers are refunded automatically.
              </p>
              <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" onSubmit={onCancelRouteDay}>
                <label className="block text-sm">
                  Route
                  <select
                    required
                    className="mt-1 block w-full rounded border px-3 py-2"
                    value={cancelDayForm.routeId}
                    onChange={(e) =>
                      setCancelDayForm((prev) => ({ ...prev, routeId: e.target.value }))
                    }
                  >
                    <option value="">Select route…</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Date
                  <input
                    required
                    type="date"
                    className="mt-1 block w-full rounded border px-3 py-2"
                    value={cancelDayForm.serviceDate}
                    onChange={(e) =>
                      setCancelDayForm((prev) => ({ ...prev, serviceDate: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm lg:col-span-2">
                  Reason (optional)
                  <input
                    type="text"
                    placeholder="Bus breakdown"
                    className="mt-1 block w-full rounded border px-3 py-2"
                    value={cancelDayForm.reason}
                    onChange={(e) =>
                      setCancelDayForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100"
                >
                  Cancel for this day
                </button>
              </form>
              <form
                className="mt-3 flex flex-wrap items-end gap-3 border-t border-amber-200/80 pt-3"
                onSubmit={onRestoreRouteDay}
              >
                <p className="w-full text-xs text-gray-600">
                  Undo a day cancellation — reopens booking for that date. Refunded tickets stay
                  cancelled; passengers must book again.
                </p>
                <button
                  type="submit"
                  className="rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-100"
                >
                  Restore for this day
                </button>
              </form>
            </section>

            <section className="card">
              <h2 className="font-semibold text-charcoal">Fleet (bus numbers)</h2>
              <p className="mt-1 text-xs text-gray-500">
                Fleet status is separate from route assignment. A bus can be fleet-active but not
                assigned to any running route.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {buses.map((b) => {
                  const assignment = busRouteAssignment(b.id);
                  return (
                  <li key={b.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-50 pb-2">
                    <span>
                      <strong>{b.registrationNumber}</strong>
                      {b.name ? ` · ${b.name}` : ''}
                      <span className="ml-2 text-xs text-gray-500">{b.busType.name}</span>
                      {assignment?.running && (
                        <span className="ml-2 text-xs font-medium text-green-700">
                          On {assignment.route.code}
                        </span>
                      )}
                      {assignment && !assignment.running && (
                        <span className="ml-2 text-xs text-gray-500">
                          Was on {assignment.route.code} (stopped)
                        </span>
                      )}
                      {!assignment && b.status === 'ACTIVE' && (
                        <span className="ml-2 text-xs text-gray-400">Unassigned</span>
                      )}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        assignment?.running
                          ? 'text-green-700'
                          : b.status === 'ACTIVE'
                            ? 'text-gray-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {assignment?.running ? 'On route' : b.status}
                    </span>
                  </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}

        {tab === 'crew' && (
          <div className="mt-6 space-y-6">
            <section className="card">
              <h2 className="font-semibold text-charcoal">Bus crew</h2>
              <p className="mt-1 text-xs text-gray-500">
                Set two drivers and one conductor for the Jharsuguda–Bangalore service. Crew details
                appear in customer search results for each bus.
              </p>
            </section>

            {busCrew.map((bus) => {
              const editing = editingCrewId === bus.id;
              const assignment = bus.activeAssignment;
              return (
                <section key={bus.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-charcoal">{bus.registrationNumber}</h3>
                        {bus.name && (
                          <span className="text-sm text-gray-600">{bus.name}</span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            bus.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {bus.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{bus.busType.name}</p>
                      {assignment ? (
                        <p className="mt-2 text-sm text-gray-700">
                          Assigned route:{' '}
                          <strong>
                            {assignment.routeCode} · {assignment.routeName}
                          </strong>
                          {assignment.routeIsActive ? (
                            <>
                              {' '}
                              · departs {formatDepartureTime(assignment.departureTime)}
                            </>
                          ) : (
                            <span className="text-gray-500"> (route stopped)</span>
                          )}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-amber-700">No active route assignment</p>
                      )}
                    </div>
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => startEditCrew(bus)}
                        className="rounded-lg border border-brand/30 px-3 py-2 text-sm font-medium text-brand hover:bg-brand-light/40"
                      >
                        Edit crew
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <form
                      className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onSaveCrew(bus.id);
                      }}
                    >
                      <label className="block text-sm">
                        Driver 1
                        <input
                          type="text"
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={crewDraft.driver1Name}
                          onChange={(event) =>
                            setCrewDraft((prev) => ({ ...prev, driver1Name: event.target.value }))
                          }
                          placeholder="Primary driver name"
                        />
                      </label>
                      <label className="block text-sm">
                        Driver 2
                        <input
                          type="text"
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={crewDraft.driver2Name}
                          onChange={(event) =>
                            setCrewDraft((prev) => ({ ...prev, driver2Name: event.target.value }))
                          }
                          placeholder="Second driver name"
                        />
                      </label>
                      <label className="block text-sm">
                        Conductor
                        <input
                          type="text"
                          className="mt-1 w-full rounded border px-3 py-2"
                          value={crewDraft.conductorName}
                          onChange={(event) =>
                            setCrewDraft((prev) => ({
                              ...prev,
                              conductorName: event.target.value,
                            }))
                          }
                          placeholder="Conductor name"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                        <button type="submit" className="btn-primary">
                          Save crew
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm"
                          onClick={() => setEditingCrewId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <dl className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Driver 1</dt>
                        <dd className="mt-1 font-medium text-charcoal">
                          {bus.driver1Name || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Driver 2</dt>
                        <dd className="mt-1 font-medium text-charcoal">
                          {bus.driver2Name || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Conductor</dt>
                        <dd className="mt-1 font-medium text-charcoal">
                          {bus.conductorName || '—'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </section>
              );
            })}

            {busCrew.length === 0 && (
              <p className="text-sm text-gray-500">No buses registered yet.</p>
            )}
          </div>
        )}

        {tab === 'coupons' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="font-semibold">Active & past coupons</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {coupons.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-2"
                  >
                    <div>
                      <strong className={c.isActive ? '' : 'text-gray-400 line-through'}>{c.code}</strong>
                      <span className="ml-2 text-gray-500">
                        {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                      </span>
                      {!c.isActive && <span className="ml-2 text-xs text-red-600">inactive</span>}
                      <p className="text-xs text-gray-400">Used {c.usedCount} times</p>
                    </div>
                    {c.isActive && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => onDeleteCoupon(c.id, c.code)}
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="font-semibold">Add coupon</h2>
              <form className="mt-4 space-y-3 text-sm" onSubmit={onCreateCoupon}>
                <input
                  required
                  placeholder="Code e.g. SUMMER20"
                  className="w-full rounded border px-3 py-2"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                />
                <input
                  placeholder="Description"
                  className="w-full rounded border px-3 py-2"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                />
                <div className="flex gap-2">
                  <select
                    className="rounded border px-3 py-2"
                    value={couponForm.discountType}
                    onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
                  >
                    <option value="PERCENT">Percent off</option>
                    <option value="FLAT">Flat ₹ off</option>
                  </select>
                  <input
                    required
                    type="number"
                    min={1}
                    className="w-24 rounded border px-3 py-2"
                    value={couponForm.discountValue}
                    onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Min ₹"
                    className="w-24 rounded border px-3 py-2"
                    value={couponForm.minOrderAmount}
                    onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Create coupon
                </button>
              </form>
            </section>
          </div>
        )}

        {tab === 'fares' && (
          <div className="mt-6 space-y-6">
            <section className="card">
              <h2 className="font-semibold">Set seat price by route segment</h2>
              <p className="mt-1 text-xs text-gray-500">
                Fares apply to all upcoming trips on the selected route. Change anytime — new bookings use the
                updated price.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <select
                  className="rounded border px-3 py-2 text-sm"
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              {selectedRoute && (
                <p className="mt-2 text-xs text-gray-600">
                  Stops:{' '}
                  {selectedRoute.routeStops
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => `${s.sequence}:${s.stop.city ?? s.stop.name}`)
                    .join(' · ')}
                </p>
              )}
              {selectedRoute && selectedRoute.routeStops.length >= 2 && (
                <p className="mt-2 rounded-lg border border-brand/20 bg-brand-light/30 px-3 py-2 text-xs text-charcoal">
                  Customer search <strong>Jharsuguda → Bangalore</strong> uses the fare from stop{' '}
                  <strong>
                    {Math.min(...selectedRoute.routeStops.map((s) => s.sequence))} →{' '}
                    {Math.max(...selectedRoute.routeStops.map((s) => s.sequence))}
                  </strong>{' '}
                  (first stop to last stop). Set that segment price below — other segment fares apply
                  only to partial journeys between intermediate stops.
                </p>
              )}
              <form className="mt-4 flex flex-wrap items-end gap-2 text-sm" onSubmit={onSaveFare}>
                <label>
                  From stop #
                  <input
                    className="mt-1 block w-20 rounded border px-2 py-1"
                    value={fareForm.fromSequence}
                    onChange={(e) => setFareForm({ ...fareForm, fromSequence: e.target.value })}
                  />
                </label>
                <label>
                  To stop #
                  <input
                    className="mt-1 block w-20 rounded border px-2 py-1"
                    value={fareForm.toSequence}
                    onChange={(e) => setFareForm({ ...fareForm, toSequence: e.target.value })}
                  />
                </label>
                <label>
                  Price per seat (₹)
                  <input
                    className="mt-1 block w-28 rounded border px-2 py-1"
                    value={fareForm.amount}
                    onChange={(e) => setFareForm({ ...fareForm, amount: e.target.value })}
                  />
                </label>
                <button type="submit" className="btn-primary">
                  Save fare
                </button>
              </form>
              <ul className="mt-4 space-y-2 text-sm">
                {fares.map((f) => (
                  <li key={f.id} className="flex justify-between gap-2 border-b border-gray-50 pb-2">
                    <span>
                      Stop {f.fromSequence} → {f.toSequence}: <strong>₹{Number(f.amount)}</strong>
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => onDeleteFare(f.fromSequence, f.toSequence)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="font-semibold">Daily seat discounts (per trip)</h2>
              <p className="mt-1 text-xs text-gray-500">
                When departure is near and seats are still empty, set a lower price on specific unbooked seats
                for that day&apos;s trip only. Uses the route segment above (from / to stop #).
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
                <label>
                  Trip
                  <select
                    className="mt-1 block min-w-[240px] rounded border px-3 py-2"
                    value={selectedTripId}
                    onChange={(e) => {
                      setSelectedTripId(e.target.value);
                      if (e.target.value) loadTripPricing(e.target.value);
                      else setTripPricing(null);
                    }}
                  >
                    <option value="">Select upcoming trip…</option>
                    {trips
                      .filter((t) => t.status === 'SCHEDULED' || t.status === 'BOARDING')
                      .map((t) => (
                      <option key={t.id} value={t.id}>
                        {new Date(t.departureAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}{' '}
                        · {t.route.code}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!selectedTripId}
                  onClick={() => loadTripPricing(selectedTripId)}
                >
                  Reload seats
                </button>
                <label>
                  Bulk price (₹)
                  <input
                    className="mt-1 block w-24 rounded border px-2 py-1"
                    value={bulkSeatPrice}
                    onChange={(e) => setBulkSeatPrice(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-brand/30 px-3 py-2 text-brand hover:bg-brand-light/40"
                  disabled={!selectedTripId || !tripPricing}
                  onClick={onBulkApplySeatPrices}
                >
                  Apply to all available
                </button>
              </div>

              {tripPricing && (
                <div className="mt-4 rounded-lg border border-brand/10 bg-brand-light/20 px-3 py-2 text-xs text-gray-700">
                  <strong>{tripPricing.trip.route.name}</strong> ·{' '}
                  {new Date(tripPricing.trip.departureAt).toLocaleString('en-IN')} ·{' '}
                  {tripPricing.trip.availableSeats} seats available ·{' '}
                  {tripPricing.trip.hoursUntilDeparture}h until departure · base ₹
                  {tripPricing.segment.baseFare}
                </div>
              )}

              {tripPricing && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr>
                        <th className="pb-2">Seat</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Base</th>
                        <th className="pb-2">Override (₹)</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tripPricing.seats.map((seat) => (
                        <tr key={seat.id} className="border-t border-gray-100">
                          <td className="py-2 font-medium">{seat.label}</td>
                          <td className="py-2 capitalize text-gray-600">{seat.status}</td>
                          <td className="py-2">₹{seat.baseFare}</td>
                          <td className="py-2">
                            {seat.status === 'available' ? (
                              <input
                                className="w-24 rounded border px-2 py-1"
                                placeholder={String(seat.baseFare)}
                                value={seatPriceDrafts[seat.id] ?? ''}
                                onChange={(e) =>
                                  setSeatPriceDrafts((prev) => ({ ...prev, [seat.id]: e.target.value }))
                                }
                              />
                            ) : (
                              <span className="text-gray-400">
                                {seat.overridden ? `₹${seat.effectiveFare}` : '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            {seat.status === 'available' ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="text-xs text-brand hover:underline"
                                  onClick={() => onSaveSeatOverride(seat.id)}
                                >
                                  Save
                                </button>
                                {seat.overridden && (
                                  <button
                                    type="button"
                                    className="text-xs text-red-600 hover:underline"
                                    onClick={() => onClearSeatOverride(seat.id)}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not editable</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card overflow-x-auto">
              <h2 className="font-semibold">Upcoming trips (next 21 days)</h2>
              <p className="mt-1 text-xs text-gray-500">
                Cancel a single trip from here, or use &quot;Cancel route for a day&quot; above to
                stop all departures on one date.
              </p>
              <table className="mt-4 w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Route</th>
                    <th className="pb-2">Bus</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Bookings</th>
                    <th className="pb-2">Schedule base</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100">
                      <td className="py-2">
                        {new Date(t.departureAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2">{t.route.code}</td>
                      <td className="py-2">{t.bus.name ?? t.bus.registrationNumber}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : t.status === 'SCHEDULED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2">{t._count?.bookings ?? 0}</td>
                      <td className="py-2">₹{Number(t.schedule.baseFare)}</td>
                      <td className="py-2">
                        {t.status === 'SCHEDULED' || t.status === 'BOARDING' ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-700 hover:underline"
                            onClick={() =>
                              onCancelTrip(
                                t.id,
                                t.route.code,
                                new Date(t.serviceDate).toLocaleDateString('en-IN'),
                              )
                            }
                          >
                            Cancel trip
                          </button>
                        ) : t.status === 'CANCELLED' ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-green-700 hover:underline"
                            onClick={() =>
                              onRestoreTrip(
                                t.id,
                                t.route.code,
                                new Date(t.serviceDate).toLocaleDateString('en-IN'),
                              )
                            }
                          >
                            Restore trip
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {tab === 'discounts' && settings && (
          <section className="card mt-6 max-w-lg">
            <h2 className="font-semibold">Passenger discounts</h2>
            <p className="mt-1 text-xs text-gray-500">
              Turn senior / child discounts on or off for all new bookings.
            </p>
            <form className="mt-4 space-y-4 text-sm" onSubmit={onSaveDiscounts}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.seniorDiscountEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, seniorDiscountEnabled: e.target.checked })
                  }
                />
                Senior citizen discount
              </label>
              {settings.seniorDiscountEnabled && (
                <label className="block">
                  Senior discount %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1 w-24 rounded border px-2 py-1"
                    value={settings.seniorDiscountPercent}
                    onChange={(e) =>
                      setSettings({ ...settings, seniorDiscountPercent: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.childDiscountEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, childDiscountEnabled: e.target.checked })
                  }
                />
                Child discount
              </label>
              {settings.childDiscountEnabled && (
                <div className="flex gap-4">
                  <label className="block">
                    Child discount %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="mt-1 w-24 rounded border px-2 py-1"
                      value={settings.childDiscountPercent}
                      onChange={(e) =>
                        setSettings({ ...settings, childDiscountPercent: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="block">
                    Max child age
                    <input
                      type="number"
                      min={1}
                      max={17}
                      className="mt-1 w-20 rounded border px-2 py-1"
                      value={settings.childMaxAge}
                      onChange={(e) =>
                        setSettings({ ...settings, childMaxAge: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              )}
              <button type="submit" className="btn-primary">
                Save discount settings
              </button>
            </form>
          </section>
        )}

        {tab === 'agents' && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="font-semibold">Agent accounts</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {agents.map((a) => (
                  <li key={a.id} className="border-b border-gray-50 pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.user.fullName}</p>
                        <p className="text-gray-500">{a.user.email}</p>
                        <p className="text-xs text-gray-400">
                          {a.employeeCode} · {a.commissionRatePercent}% commission
                          {!a.isActive && ' · deactivated'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand hover:underline"
                          onClick={() => onToggleAgent(a.id, a.isActive)}
                        >
                          {a.isActive ? 'Disable' : 'Enable'}
                        </button>
                        {a.isActive && (
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => onDeactivateAgent(a.id, a.user.fullName)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="font-semibold">Create agent</h2>
              <form className="mt-4 space-y-3 text-sm" onSubmit={onCreateAgent}>
                {(
                  [
                    ['fullName', 'Full name'],
                    ['email', 'Email'],
                    ['phone', 'Phone (10 digits)'],
                    ['employeeCode', 'Employee code'],
                    ['password', 'Password'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    {label}
                    <input
                      required={key !== 'password'}
                      type={key === 'password' ? 'password' : 'text'}
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={agentForm[key]}
                      onChange={(e) => setAgentForm({ ...agentForm, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <div className="flex gap-3">
                  <label className="block flex-1">
                    Salary (₹/mo)
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={agentForm.salaryMonthly}
                      onChange={(e) => setAgentForm({ ...agentForm, salaryMonthly: e.target.value })}
                    />
                  </label>
                  <label className="block w-28">
                    Commission %
                    <input
                      type="number"
                      max={4}
                      className="mt-1 w-full rounded border px-3 py-2"
                      value={agentForm.commissionRatePercent}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, commissionRatePercent: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button type="submit" className="btn-primary">
                  Create agent
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
