interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-t3">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-t1">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-t2">{description}</p>
      </div>
      {action}
    </div>
  );
}