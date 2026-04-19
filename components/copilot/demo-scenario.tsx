"use client";
import { cn } from "@/lib/cn";
import { ChevronRight, Play, RotateCcw, Sparkles } from "lucide-react";

const steps = [
  { label: "View Load", description: "Select PHX-2847 (Phoenix → Dallas)" },
  { label: "Dispatch AI", description: "See driver ranking & cost analysis" },
  { label: "Simulate 2h Delay", description: "Trigger pickup detention event" },
  { label: "View Impact", description: "HOS, parking, ETA cascading effects" },
  { label: "CoPilot Response", description: "Backup stop + notify customer" },
];

interface Props {
  currentStep: number;
  onAdvance: () => void;
  onReset: () => void;
}

export function DemoScenario({ currentStep, onAdvance, onReset }: Props) {
  const isComplete = currentStep >= steps.length;

  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-brand-50 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-brand-700">Demo Scenario</div>
            <div className="text-[10px] text-ink-500">Phoenix → Dallas · 2h Shipper Delay</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isComplete ? (
            <button
              onClick={onAdvance}
              className="group flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-600 hover:shadow-md"
            >
              <Play className="h-3 w-3 transition-transform group-hover:scale-110" />
              {currentStep === 0 ? "Start Demo" : steps[currentStep]?.label ?? "Next"}
            </button>
          ) : (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Demo
            </button>
          )}
        </div>
      </div>

      {/* Step progress */}
      <div className="mt-3 flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={i} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all",
                i < currentStep
                  ? "bg-brand-500 text-white"
                  : i === currentStep
                    ? "bg-brand-100 text-brand-700 ring-2 ring-brand-300"
                    : "bg-ink-100 text-ink-400",
              )}
            >
              {i + 1}
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <div
                className={cn(
                  "truncate text-[10px] font-medium",
                  i <= currentStep ? "text-ink-700" : "text-ink-400",
                )}
              >
                {step.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight
                className={cn(
                  "h-3 w-3 shrink-0",
                  i < currentStep ? "text-brand-400" : "text-ink-300",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current step description */}
      {currentStep < steps.length && (
        <div className="mt-2 rounded-md bg-white/80 px-3 py-1.5 text-[11px] text-ink-600">
          <span className="font-semibold text-brand-600">Step {currentStep + 1}:</span>{" "}
          {steps[currentStep].description}
        </div>
      )}
      {isComplete && (
        <div className="mt-2 rounded-md bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
          ✓ Demo complete — CoPilot identified the problem, recalculated the plan, and recommended actions within seconds.
        </div>
      )}
    </div>
  );
}
