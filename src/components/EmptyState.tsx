import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
    <div className="rounded-full bg-brand-gradient p-3 shadow-glow-brand mb-4">
      <Icon className="h-6 w-6 text-primary-foreground" />
    </div>
    <h3 className="font-semibold text-lg">{title}</h3>
    {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
