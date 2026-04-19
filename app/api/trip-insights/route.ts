import { NextResponse } from "next/server";

interface Body {
  miles: number;
  minutes: number;
  stopCount: number;
  profile?: { name?: string; weight_limit?: number; truck_ft_height?: number };
  stops?: Array<{ address_name: string }>;
}

export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  const hours = b.minutes / 60;
  const hoursOfService = 11;
  const legs = Math.max(1, Math.ceil(hours / hoursOfService));
  const fuelGal = b.miles / 6;
  const fuelCost = fuelGal * 3.85;
  const tolls = Math.round(b.miles * 0.01 * 100) / 100;
  const heavy = (b.profile?.weight_limit ?? 80000) > 80000;
  const tall = (b.profile?.truck_ft_height ?? 13) >= 14;
  const insights: string[] = [];
  insights.push(
    `Roughly ${b.miles.toFixed(0)} mi / ${hours.toFixed(1)} h across ${b.stopCount} stops.`,
  );
  if (legs > 1) insights.push(`Plan ${legs} driving shifts to stay inside HOS limits.`);
  insights.push(
    `Estimated fuel: ${fuelGal.toFixed(1)} gal (~$${fuelCost.toFixed(0)}) at 6 MPG, $3.85/gal.`,
  );
  if (tolls > 0) insights.push(`Rough toll estimate: $${tolls.toFixed(2)}.`);
  if (heavy) insights.push("Permits may be required — GVW above 80,000 lb.");
  if (tall) insights.push("Watch for low clearances — unit is ≥14 ft tall.");
  if (hours > 8) insights.push("Route is long — schedule a 30-min rest at the midpoint.");
  return NextResponse.json({ insights, fuelGal, fuelCost, tolls });
}
