import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common";
import { EmergencyForm } from "@/components/emergency/EmergencyForm";
import { AllocationResultCard } from "@/components/emergency/AllocationResultCard";
import { RequestsTable } from "@/components/emergency/RequestsTable";
import { PriorityQueue } from "@/components/emergency/PriorityQueue";
import { CapacityFinder } from "@/components/emergency/CapacityFinder";
import { useAuth } from "@/contexts/AuthContext";
import type { AllocationResult } from "@/types/api";

export function EmergencyPage() {
  const [result, setResult] = useState<AllocationResult | null>(null);
  const { hasRole } = useAuth();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Emergency"
        description="Raise a request: the nearest hospital with a free bed of the required type is reserved instantly."
      />
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>New emergency request</CardTitle>
              <CardDescription>Use fictional patient details only.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmergencyForm onResult={setResult} />
            </CardContent>
          </Card>
          {result && <AllocationResultCard result={result} onClose={() => setResult(null)} />}
          <PriorityQueue />
          {hasRole("ADMIN", "DISPATCHER") && <CapacityFinder />}
        </div>
        <div className="min-w-0">
          <RequestsTable />
        </div>
      </div>
    </div>
  );
}
