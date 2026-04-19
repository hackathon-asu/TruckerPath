import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GEMINI_MODEL, hasGeminiConfig } from "@/lib/gemini";

interface Body {
  miles: number;
  minutes: number;
  stopCount: number;
  profile?: { name?: string; weight_limit?: number; truck_ft_height?: number; truck_ft_width?: number; hazmat?: boolean };
  stops?: Array<{ address_name: string }>;
  borderCrossings?: string[];
}

export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  const hours = b.minutes / 60;
  const hoursOfService = 11;
  const legs = Math.max(1, Math.ceil(hours / hoursOfService));
  const fuelGal = b.miles / 6;
  const fuelCost = fuelGal * 3.85;
  const tolls = Math.round(b.miles * 0.01 * 100) / 100;
  
  const insights: string[] = [];
  insights.push(`Roughly ${b.miles.toFixed(0)} mi / ${hours.toFixed(1)} h across ${b.stopCount} stops.`);
  if (legs > 1) insights.push(`Plan ${legs} driving shifts to stay inside HOS limits.`);
  insights.push(`Estimated fuel: ${fuelGal.toFixed(1)} gal (~$${fuelCost.toFixed(0)}) at 6 MPG, $3.85/gal.`);
  if (tolls > 0) insights.push(`Rough toll estimate: $${tolls.toFixed(2)}.`);

  if (hasGeminiConfig && b.borderCrossings && b.borderCrossings.length > 0) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
      const prompt = `You are a senior freight permitting specialist. A truck is taking a route crossing these borders: ${b.borderCrossings.join(", ")}. 
The truck profile is: ${JSON.stringify(b.profile)}. 
Provide exactly 2 concise, highly specific actionable insights (under 15 words each) about permit coordination, state reciprocity, or Port of Entry (POE) requirements for this specific state-to-state sequence. Do not use markdown. Focus on real-world trucking rules.`;
      
      const { text } = await generateText({
        model: google(GEMINI_MODEL),
        prompt,
      });
      
      const aiInsights = text.split('\n').filter((l: string) => l.trim().length > 0).map((l: string) => l.replace(/^[-•*]\s*/, '').trim());
      insights.push(...aiInsights);
    } catch (e) {
      console.error("AI Insight Error:", e);
      insights.push("Multi-state coordination required. Verify POE and permit requirements.");
    }
  } else {
    const heavy = (b.profile?.weight_limit ?? 80000) > 80000;
    const tall = (b.profile?.truck_ft_height ?? 13) >= 14;
    if (heavy) insights.push("Permits may be required — GVW above 80,000 lb.");
    if (tall) insights.push("Watch for low clearances — unit is ≥14 ft tall.");
  }

  if (hours > 8 && legs === 1) insights.push("Route is long — schedule a 30-min rest at the midpoint.");
  return NextResponse.json({ insights, fuelGal, fuelCost, tolls });
}
