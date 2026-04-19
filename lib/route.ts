export type RouteLabel = "Fastest Route" | "Shortest Route" | "Most Economical";

export interface RouteStep {
  instruction: string;
  miles: number;
  minutes: number;
}

export interface RouteLeg {
  miles: number;
  minutes: number;
  tolls: number;
  steps: RouteStep[];
}

export interface RouteAlt {
  id: string;
  label: RouteLabel;
  miles: number;
  minutes: number;
  gallons: number;
  fuelCost: number;
  tolls: number;
  polyline: [number, number][];
  legs: RouteLeg[];
}
