import { NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const { event } = await req.json();

    // In a real agent workflow, we would query the database here to get the full context
    // of the load, driver, and surrounding parking stops. For this prototype event response, 
    // we'll pass the immediate event and mock a few contextual details for the AI to process.

    const { data: loadInfo } = await insforge.database.from("loads").select("*").eq("id", event.loadId).single();
    
    // Pass event to Vercel AI SDK
    const result = await generateObject({
      model: google("gemini-1.5-flash"),
      system: `You are an autonomous AI Dispatcher Agent monitoring fleet events. 
A new event just occurred in the simulation. Analyze the event and determine what cascadaing effects it has on Hours of Service, ETA, and Parking. 
Draft exactly ONE distinct CopilotAlert to notify the human dispatcher.`,
      prompt: `Event details: ${JSON.stringify(event, null, 2)}\nLoad Info: ${JSON.stringify(loadInfo, null, 2)}`,
      schema: z.object({
        alert: z.object({
          type: z.enum(["detention_delay", "parking_risk", "late_delivery_risk", "hos_violation_risk", "detention_cost", "better_driver"]),
          severity: z.enum(["critical", "warning", "info"]),
          title: z.string(),
          message: z.string().describe("Human readable explanation of the risk"),
          actionLabel: z.string().optional().describe("E.g., 'View Impact'"),
        })
      })
    });

    const alert = {
      id: `ai-alert-${Date.now()}`,
      ...result.object.alert,
      load_id: event.loadId,
      timestamp: new Date().toISOString(),
      dismissed: false
    };

    // Insert alert into database so realtime feed picks it up
    const { error } = await insforge.database.from("copilot_alerts").insert([alert]);
    
    if (error) {
      console.error("Failed to insert AI alert:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert });
  } catch (error: any) {
    console.error("Agent Trigger Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
