export const VEHICLE_OPTIONS = [
  { id: "auto", label: "Auto", noun: "auto-rickshaw" },
];

const AUTO_VEHICLE = VEHICLE_OPTIONS[0];

export function getVehicleOption() {
  return AUTO_VEHICLE;
}

export function getVehicleLabel() {
  return AUTO_VEHICLE.label;
}

export function getVehicleNoun() {
  return AUTO_VEHICLE.noun;
}
