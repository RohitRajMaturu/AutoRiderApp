export const VEHICLE_OPTIONS = [
  { id: "auto", label: "Auto", noun: "auto-rickshaw" },
  { id: "car", label: "Car", noun: "car" },
  { id: "truck", label: "Truck", noun: "truck" },
  { id: "bus", label: "Bus", noun: "bus" },
  { id: "bike", label: "Bike", noun: "bike" },
];

const FALLBACK_VEHICLE = VEHICLE_OPTIONS[0];

export function getVehicleOption(type) {
  return VEHICLE_OPTIONS.find((vehicle) => vehicle.id === type) || FALLBACK_VEHICLE;
}

export function getVehicleLabel(type) {
  return getVehicleOption(type).label;
}

export function getVehicleNoun(type) {
  return getVehicleOption(type).noun;
}
