import { AlertCircle, CheckCircle2, Download, Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExportStatusPanelProps {
  activeDistrict: string | null;
  errorMessage: string;
  onReset: () => void;
  recordCount: string | null;
  status: "idle" | "loading" | "success" | "error";
  warningCount: string | null;
}

const loadingSteps = [
  "Connecting to EDJOIN search…",
  "Fetching job listings…",
  "Filtering results…",
  "Building workbook…"
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/60 flex-1 rounded-lg px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-foreground text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function ExportStatusPanel({
  activeDistrict,
  errorMessage,
  onReset,
  recordCount,
  status,
  warningCount
}: ExportStatusPanelProps) {
  if (status === "loading") {
    return (
      <Card role="status" aria-live="polite" className="rounded-2xl shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
              In progress
            </Badge>
          </div>
          <CardTitle className="text-base">Building your export</CardTitle>
          <div className="bg-border h-1 w-full overflow-hidden rounded-full" aria-hidden="true">
            <div className="bg-primary h-full w-1/2 animate-[progressSlide_1.4s_ease-in-out_infinite] rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loadingSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 text-sm">
              <span
                className={
                  index === 0
                    ? "bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full"
                    : "bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full"
                }
                aria-hidden="true"
              >
                {index === 0 ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : (
                  <span className="text-[9px] font-bold">{index + 1}</span>
                )}
              </span>
              <span className={index === 0 ? "text-foreground font-medium" : "text-muted-foreground"}>{step}</span>
            </div>
          ))}
          <p className="text-muted-foreground text-xs">
            {activeDistrict
              ? `Currently parsing ${activeDistrict}.`
              : "Waiting for the backend to report the active district."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card role="status" aria-live="polite" className="rounded-2xl shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-primary size-5" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Export complete</CardTitle>
              <p className="text-muted-foreground text-sm">Your workbook was downloaded from the polling result.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(recordCount !== null || warningCount !== null) && (
            <div className="flex gap-3 text-sm">
              {recordCount && <StatCard label="Records" value={recordCount} />}
              {warningCount && <StatCard label="Warnings" value={warningCount} />}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Download data-icon="inline-start" aria-hidden="true" />
              Workbook ready
            </Badge>
            {warningCount && warningCount !== "0" && (
              <Badge variant="muted">
                <TriangleAlert data-icon="inline-start" aria-hidden="true" />
                Review warnings
              </Badge>
            )}
          </div>
          <Button type="button" onClick={onReset} variant="link" className="h-auto justify-start px-0 text-xs">
            Run another export
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Alert
        variant={recordCount !== null || warningCount !== null ? "default" : "destructive"}
        className="rounded-2xl shadow-sm"
      >
        <AlertCircle aria-hidden="true" />
        <AlertTitle>
          {recordCount !== null || warningCount !== null ? "Export finished with issues" : "Export failed"}
        </AlertTitle>
        <AlertDescription className="break-words">{errorMessage}</AlertDescription>
        <div className="mt-3">
          <Button
            type="button"
            onClick={onReset}
            variant="link"
            className="h-auto justify-start px-0 text-xs text-inherit"
          >
            Try again
          </Button>
        </div>
      </Alert>
    );
  }

  return null;
}
