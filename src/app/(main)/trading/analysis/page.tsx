import { Suspense } from "react";
import { AnalysisView } from "./_components/analysis-view";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <Suspense>
        <AnalysisView />
      </Suspense>
    </div>
  );
}
