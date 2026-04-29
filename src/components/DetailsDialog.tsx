import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Row = { label: string; value: ReactNode };

export function DetailsDialog({
  open,
  onOpenChange,
  title,
  rows,
  extra,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  rows: Row[];
  extra?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r, i) => (
            <div key={i} className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.label}</div>
              <div className="text-sm font-medium break-words">{r.value || "—"}</div>
            </div>
          ))}
        </div>
        {extra && <div className="mt-3 border-t pt-3">{extra}</div>}
      </DialogContent>
    </Dialog>
  );
}
