export function AppIntro() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-foreground text-2xl font-bold tracking-tight text-balance">
        Build a raw Excel export from live EDJOIN search results.
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Choose a state, then select search regions and districts. Location data is loaded progressively from EDJOIN —
        only one state can be selected at a time. Once your locations are set, add optional keyword filters and click{" "}
        <strong className="text-foreground font-medium">Generate Excel export</strong> to generate and download the
        workbook.
      </p>
    </section>
  );
}
