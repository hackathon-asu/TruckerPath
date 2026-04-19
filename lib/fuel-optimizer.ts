import { generatePoisAlongRoute, type RoutePoi } from "./poi-along-route";

export interface FuelPlanInput {
  polyline: [number, number][];
  totalMiles: number;
  startTankGal: number;
  tankCapacityGal: number;
  lowMpg: number;
  minBuyGal: number;
  averagePrice?: number;
}

export interface FuelStop {
  poi: RoutePoi;
  arrivalTankGal: number;
  fillGal: number;
  pricePerGal: number;
  cost: number;
}

export interface FuelPlanResult {
  plan: FuelStop[];
  optimizedCost: number;
  smartAverageCost: number;
  totalGal: number;
  avgPumpPrice: number;
}

const SAFETY_TANK = 25; // always leave this many gal

export function computeFuelPlan(input: FuelPlanInput): FuelPlanResult {
  const pois = generatePoisAlongRoute(input.polyline, input.totalMiles).filter(
    (p) => p.category === "fuel" && p.pumpPrice != null,
  );
  if (pois.length === 0 || input.totalMiles < 10) {
    return { plan: [], optimizedCost: 0, smartAverageCost: 0, totalGal: 0, avgPumpPrice: 0 };
  }

  const plan: FuelStop[] = [];
  let tank = input.startTankGal;
  let lastMile = 0;

  for (const poi of pois) {
    const legMiles = poi.routeMile - lastMile;
    const legGal = legMiles / input.lowMpg;
    tank -= legGal;
    if (tank < SAFETY_TANK) {
      const fillGal = Math.min(
        Math.max(input.minBuyGal, input.tankCapacityGal - tank),
        input.tankCapacityGal - tank,
      );
      const cost = fillGal * (poi.pumpPrice as number);
      plan.push({ poi, arrivalTankGal: tank, fillGal, pricePerGal: poi.pumpPrice as number, cost });
      tank += fillGal;
    }
    lastMile = poi.routeMile;
  }

  const remainingMiles = input.totalMiles - lastMile;
  const fuelNeeded = remainingMiles / input.lowMpg;
  if (tank < fuelNeeded + SAFETY_TANK && pois.length > 0) {
    const last = pois[pois.length - 1];
    const fillGal = Math.max(input.minBuyGal, fuelNeeded - tank + SAFETY_TANK);
    plan.push({
      poi: last,
      arrivalTankGal: tank,
      fillGal,
      pricePerGal: last.pumpPrice as number,
      cost: fillGal * (last.pumpPrice as number),
    });
  }

  const totalGal = plan.reduce((s, p) => s + p.fillGal, 0);
  const optimizedCost = plan.reduce((s, p) => s + p.cost, 0);
  const avgPumpPrice = pois.reduce((s, p) => s + (p.pumpPrice ?? 0), 0) / pois.length;
  const smartAverageCost = (input.averagePrice ?? avgPumpPrice) * (input.totalMiles / input.lowMpg);

  return { plan, optimizedCost, smartAverageCost, totalGal, avgPumpPrice };
}
