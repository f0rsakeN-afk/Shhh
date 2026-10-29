import Link from "next/link"

interface PageHeaderProps {
  title: string
  description?: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="space-y-2 text-center">
      <Link
        href="/"
        className="inline-block text-[1.8rem] font-semibold leading-none tracking-tight text-foreground transition-colors hover:text-brand"
      >
        {title}
      </Link>
      {description && (
        <p className="px-2 text-[12px] leading-6 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
