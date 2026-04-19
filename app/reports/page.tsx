import { IconRail } from "@/components/icon-rail";
import { ReportsDashboard } from "@/components/reports/dashboard";
import { TopHeader } from "@/components/top-header";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <div className="flex h-screen flex-col">
      <TopHeader />
      <div className="flex flex-1 overflow-hidden">
        <IconRail />
        <ReportsDashboard />
      </div>
    </div>
  );
}
