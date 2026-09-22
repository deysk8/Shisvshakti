export type SeatMapItem = {

  id: string;

  label: string;

  deck: string;

  seatType: string;

  rowIndex: number | null;

  colIndex: number | null;

  status: 'available' | 'booked' | 'locked';

  fare?: number;

  baseFare?: number;

  discounted?: boolean;

};



/** Per-seat fare from API, or flat segment fare as fallback. */

export function displaySeatPrice(baseFare: number, seat: SeatMapItem): number {

  return seat.fare ?? baseFare;

}



export function sumSelectedSeatFares(

  selectedIds: string[],

  seats: SeatMapItem[],

  baseFare: number,

): number {

  return selectedIds.reduce((sum, id) => {

    const seat = seats.find((s) => s.id === id);

    return sum + (seat ? displaySeatPrice(baseFare, seat) : baseFare);

  }, 0);

}



export function buildSeatFareMap(selectedIds: string[], seats: SeatMapItem[], baseFare: number) {

  const map: Record<string, number> = {};

  for (const id of selectedIds) {

    const seat = seats.find((s) => s.id === id);

    map[id] = seat ? displaySeatPrice(baseFare, seat) : baseFare;

  }

  return map;

}



export function sumSeatFareMap(seatFares: Record<string, number> | undefined, fallbackPerSeat: number, count: number) {

  if (!seatFares || !Object.keys(seatFares).length) {

    return fallbackPerSeat * count;

  }

  return Object.values(seatFares).reduce((sum, amount) => sum + amount, 0);

}



export function formatInr(amount: number) {

  return `₹${amount}`;

}


