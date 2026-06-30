export const VEHICLE_CATEGORIES = [
  { value: 'MOTO', label: 'Moto', defaultSeats: 2 },
  { value: 'SEDAN', label: 'Sedán', defaultSeats: 4 },
  { value: 'PICKUP', label: 'Pickup / Camioneta', defaultSeats: 5 },
  { value: 'SUV_4X4', label: '4x4 / SUV', defaultSeats: 5 },
  { value: 'VAN', label: 'Van / Furgoneta', defaultSeats: 8 },
  { value: 'TRUCK', label: 'Camión', defaultSeats: 3 },
];

export function getVehicleCategoryLabel(value) {
  return VEHICLE_CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function formatVehicleSummary(driverDetails) {
  if (!driverDetails) return '';
  const category = getVehicleCategoryLabel(driverDetails.vehicleCategory);
  const seats = driverDetails.seatCount;
  const details = driverDetails.vehicleDetails;
  return `${category} · ${seats} asiento(s) · ${details} · ${driverDetails.licensePlate}`;
}
