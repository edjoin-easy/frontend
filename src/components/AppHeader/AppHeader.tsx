export function AppHeader() {
  return (
    <header className="bg-background/90 border-border fixed inset-x-0 top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <span className="bg-primary text-primary-foreground inline-flex h-8 w-8 items-center justify-center rounded-lg">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 3h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M2 3l2-2h8l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-sm font-semibold">EDJOIN Exporter</span>
          <span className="text-muted-foreground text-[11px] tracking-wide uppercase">School Jobs Export</span>
        </div>
      </div>
    </header>
  );
}
