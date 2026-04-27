import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
