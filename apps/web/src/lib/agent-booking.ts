import {
  DEFAULT_FROM_CITY,
  DEFAULT_TO_CITY,
  LAUNCH_SERVICE_DATE,
} from '@shiva-sakti/shared';

export const DEFAULT_FROM = DEFAULT_FROM_CITY;
export const DEFAULT_TO = DEFAULT_TO_CITY;

const AGENT_FLOW_KEY = 'ss_agent_flow';

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function earliestBookableDate() {
  const today = todayIsoDate();
  return today >= LAUNCH_SERVICE_DATE ? today : LAUNCH_SERVICE_DATE;
}

export function defaultAgentSearchParams(cash: boolean) {
  const params = new URLSearchParams({
    agent: '1',
    fromCity: DEFAULT_FROM,
    toCity: DEFAULT_TO,
    date: earliestBookableDate(),
  });
  if (cash) params.set('cash', '1');
  return params;
}

export function agentSearchUrl(cash: boolean) {
  return `/search?${defaultAgentSearchParams(cash).toString()}`;
}

export function buildSeatsUrl(
  tripId: string,
  opts?: {
    fromCity?: string;
    toCity?: string;
    date?: string;
    fare?: string;
    agent?: boolean;
  },
) {
  const params = new URLSearchParams({
    fromCity: opts?.fromCity ?? DEFAULT_FROM,
    toCity: opts?.toCity ?? DEFAULT_TO,
    date: opts?.date ?? earliestBookableDate(),
    fare: opts?.fare ?? '1400',
  });
  if (opts?.agent) params.set('agent', '1');
  return `/trips/${tripId}/seats?${params.toString()}`;
}

export function buildPassengersUrl(tripId: string, agent?: boolean) {
  return agent
    ? `/book/passengers?tripId=${encodeURIComponent(tripId)}&agent=1`
    : `/book/passengers?tripId=${encodeURIComponent(tripId)}`;
}

export function setAgentFlowActive(active: boolean) {
  if (typeof sessionStorage === 'undefined') return;
  if (active) sessionStorage.setItem(AGENT_FLOW_KEY, '1');
  else sessionStorage.removeItem(AGENT_FLOW_KEY);
}

export function readAgentModeFromSession() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(AGENT_FLOW_KEY) === '1';
}
