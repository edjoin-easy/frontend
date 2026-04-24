import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  RotateCcw,
  Search,
  X
} from "lucide-react";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  loadEdjoinDistricts,
  loadEdjoinSearchRegions,
  loadEdjoinStates,
  type EdjoinDistrict,
  type EdjoinSearchRegion,
  type EdjoinState
} from "@/lib/edjoin";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelectedDistrictNode {
  districtId: number;
  name: string;
}

export interface SelectedSearchRegionNode {
  allSelected: boolean;
  children: SelectedDistrictNode[];
  name: string;
  searchRegionId: number;
  totalDistrictCount: number | null;
}

export interface SelectedStateNode {
  children: SelectedSearchRegionNode[];
  name: string;
  stateId: number;
}

export interface LocationSelection {
  state: SelectedStateNode | null;
}

interface LocationSelectorProps {
  disabled?: boolean;
  invalidRegionIds?: string[];
  onChange: (next: LocationSelection) => void;
  value: LocationSelection;
}

// ─── Shared building blocks ──────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5" aria-hidden="true">
      <Skeleton className="size-4" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="ml-auto h-3 w-10" />
    </div>
  );
}

function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonRow key={idx} />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="mx-4 my-3">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Couldn&apos;t load this list</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {onRetry && (
        <div className="mt-3">
          <Button onClick={onRetry} variant="outline" size="sm">
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}
    </Alert>
  );
}

function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <Empty className="border-border mx-4 my-3 min-h-0 gap-3 rounded-lg border border-dashed px-4 py-6">
      <EmptyHeader className="gap-1">
        <EmptyTitle className="text-base font-medium">Nothing to show</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onClear && (
        <EmptyContent className="gap-0">
          <Button onClick={onClear} variant="link" size="sm" className="h-auto p-0 text-sm">
            Clear filter
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

const DISTRICT_ROW_HEIGHT_REM = 2.5;
const DISTRICT_SCROLL_PADDING_REM = 0.5;

function StepBadge({ step, completed, locked }: { step: number; completed: boolean; locked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
        locked && "bg-muted text-muted-foreground",
        !locked && completed && "bg-primary text-primary-foreground ring-primary/20 ring-4",
        !locked && !completed && "bg-primary text-primary-foreground"
      )}
      aria-hidden="true"
    >
      {completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step}
    </span>
  );
}

function SectionCard({
  step,
  completed,
  title,
  subtitle,
  locked,
  children
}: {
  step: number;
  completed: boolean;
  title: string;
  subtitle: string;
  locked: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("transition-shadow", locked && "bg-muted/30 shadow-none", !locked && "shadow-xs")}>
      <CardHeader className="flex-row items-start gap-3 px-4 pt-4 pb-3">
        <StepBadge step={step} completed={completed} locked={locked} />
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className={cn("text-base leading-tight tracking-tight", locked && "text-muted-foreground")}>
            {title}
          </CardTitle>
          <p className={cn("text-sm leading-snug", locked ? "text-muted-foreground/80" : "text-muted-foreground")}>
            {subtitle}
          </p>
        </div>
      </CardHeader>
      {!locked && (
        <>
          <Separator />
          <CardContent className="px-0 pb-0">{children}</CardContent>
        </>
      )}
    </Card>
  );
}

// ─── Step 1: State Selector ──────────────────────────────────────────────────

function StateSelector({
  value,
  onChange,
  disabled
}: {
  value: SelectedStateNode | null;
  onChange: (state: EdjoinState | null) => void;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const optionIdPrefix = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const trimmed = deferred.trim().toLowerCase();

  const {
    data: states = [],
    isError,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ["edjoin", "states"],
    queryFn: loadEdjoinStates,
    staleTime: 10 * 60 * 1000
  });

  const filtered =
    query.length === 0
      ? states
      : trimmed.length >= 2
        ? states.filter(
            (s) => s.fullname.toLowerCase().includes(trimmed) || (s.name?.toLowerCase().includes(trimmed) ?? false)
          )
        : [];

  const showMinCharHint = !isLoading && !isError && query.length > 0 && trimmed.length < 2;
  const activeIndex = Math.min(focusedIndex, Math.max(filtered.length - 1, 0));
  const activeOptionId = filtered.length > 0 ? `${optionIdPrefix}-${filtered[activeIndex].stateID}` : undefined;

  function indexOfSelected(list: EdjoinState[]) {
    if (!value) return 0;
    const idx = list.findIndex((s) => s.stateID === value.stateId);
    return idx >= 0 ? idx : 0;
  }

  function openListbox() {
    setFocusedIndex(indexOfSelected(filtered));
    setOpen(true);
  }

  // Keep the active option in view as the user arrows through (or when
  // opening the listbox with a pre-selected state far down the list).
  useEffect(() => {
    if (!open || !activeOptionId) return;
    const node = document.getElementById(activeOptionId);
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeOptionId]);

  function select(state: EdjoinState) {
    onChange(state);
    setFocusedIndex(0);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        openListbox();
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Escape") {
      setFocusedIndex(0);
      setOpen(false);
      setQuery("");
      event.preventDefault();
      return;
    }

    if (event.key === "Tab") {
      setFocusedIndex(0);
      setOpen(false);
      setQuery("");
      return;
    }

    if (showMinCharHint || filtered.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      setFocusedIndex((index) => Math.min(index + 1, filtered.length - 1));
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setFocusedIndex((index) => Math.max(index - 1, 0));
      event.preventDefault();
    } else if (event.key === "Enter") {
      select(filtered[activeIndex]);
      event.preventDefault();
    }
  }

  return (
    <div className="p-3">
      <div
        ref={containerRef}
        className="relative"
        onBlur={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
            setQuery("");
          }
        }}
      >
        {/* Trigger row — input owns combobox semantics; non-interactive wrapper styles only */}
        <div
          className={cn(
            "bg-background flex items-center gap-2 rounded-lg border px-3 transition-colors",
            "focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-2",
            !open && "border-input hover:border-ring/60",
            open && "border-ring",
            disabled && "pointer-events-none opacity-60"
          )}
        >
          {isLoading ? (
            <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          )}

          <Input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={open ? activeOptionId : undefined}
            aria-label="Search states"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
            placeholder={value ? value.name : "Select a state…"}
            value={open ? query : ""}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusedIndex(0);
              if (!open) setOpen(true);
            }}
            onFocus={openListbox}
            onKeyDown={onKeyDown}
            disabled={disabled}
          />

          {value && !open ? (
            <Button
              type="button"
              onClick={() => onChange(null)}
              onMouseDown={(e) => e.preventDefault()}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7 shrink-0 rounded-md"
              aria-label={`Clear ${value.name}`}
            >
              <X aria-hidden="true" />
            </Button>
          ) : (
            <ChevronDown
              className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <Card
            id={listboxId}
            role="listbox"
            aria-label="Available states"
            className="bg-popover absolute right-0 left-0 z-50 mt-1.5 rounded-xl py-1 shadow-xl"
          >
            <ScrollArea className="max-h-64">
              {isLoading && <LoadingRows rows={3} label="Loading states" />}

              {!isLoading && isError && <ErrorState message="Failed to load states." onRetry={() => void refetch()} />}

              {showMinCharHint && (
                <p className="text-muted-foreground px-3 py-3 text-center text-sm">
                  Type at least 2 characters to search.
                </p>
              )}

              {!isLoading && !isError && !showMinCharHint && filtered.length === 0 && (
                <EmptyState
                  message={trimmed.length >= 2 ? `No states match "${query}"` : "No states available."}
                  onClear={trimmed.length >= 2 ? () => setQuery("") : undefined}
                />
              )}

              {!isLoading &&
                !isError &&
                !showMinCharHint &&
                filtered.map((state, index) => {
                  const selected = value?.stateId === state.stateID;
                  const active = activeIndex === index;
                  return (
                    <button
                      key={state.stateID}
                      id={`${optionIdPrefix}-${state.stateID}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={selected}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => select(state)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={cn(
                        "relative flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition-colors",
                        "hover:bg-accent focus-visible:outline-none",
                        active && "bg-accent",
                        selected && "bg-primary/10"
                      )}
                    >
                      {selected && (
                        <span className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" aria-hidden="true" />
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          selected ? "text-foreground font-semibold" : "text-foreground font-medium"
                        )}
                      >
                        {state.fullname}
                      </span>
                      <span
                        className="text-muted-foreground shrink-0 text-xs tabular-nums"
                        aria-label={`${state.jobs.toLocaleString()} jobs`}
                      >
                        {state.jobs.toLocaleString()} jobs
                      </span>
                      {selected && <Check className="text-primary size-4 shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
            </ScrollArea>
          </Card>
        )}
      </div>

      <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
        Only one state can be selected at a time for scraping performance. Changing your selection will reset all
        downstream choices.
      </p>
    </div>
  );
}

// ─── Step 2: Search Regions ──────────────────────────────────────────────────

function SearchRegionSelector({
  stateId,
  selectedRegions,
  onToggle
}: {
  stateId: string;
  selectedRegions: SelectedSearchRegionNode[];
  onToggle: (region: EdjoinSearchRegion) => void;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const trimmed = deferred.trim().toLowerCase();

  const {
    data: regions = [],
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ["edjoin", "search-regions", stateId],
    queryFn: () => loadEdjoinSearchRegions(stateId),
    staleTime: 5 * 60 * 1000
  });

  // Apply min-2-char rule consistently with state selector.
  const filtered =
    query.length === 0
      ? regions
      : trimmed.length >= 2
        ? regions.filter((r) => r.countyName.toLowerCase().includes(trimmed))
        : regions;
  const showMinCharHint = trimmed.length > 0 && trimmed.length < 2;

  return (
    <div className="flex flex-col">
      {/* Search input with visible affordance */}
      <div className="px-3 py-2">
        <div className="bg-background focus-within:border-ring focus-within:ring-ring/30 relative flex items-center rounded-md border px-2.5 focus-within:ring-2">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter regions…"
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 py-0 text-sm shadow-none focus-visible:ring-0"
            aria-label="Filter search regions"
          />
          {query && (
            <Button
              type="button"
              onClick={() => setQuery("")}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-6 rounded-sm"
              aria-label="Clear filter"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* List */}
      <ScrollArea className="h-56">
        <div className="py-1">
          {isLoading && <LoadingRows rows={4} label="Loading search regions" />}

          {!isLoading && isError && (
            <ErrorState message="Failed to load search regions." onRetry={() => void refetch()} />
          )}

          {!isLoading && !isError && showMinCharHint && (
            <p className="text-muted-foreground px-4 py-3 text-center text-sm">Type at least 2 characters to filter.</p>
          )}

          {!isLoading && !isError && !showMinCharHint && filtered.length === 0 && (
            <EmptyState
              message={trimmed.length >= 2 ? `No regions match "${query}"` : "No search regions available."}
              onClear={trimmed.length >= 2 ? () => setQuery("") : undefined}
            />
          )}

          {!isLoading &&
            !isError &&
            !showMinCharHint &&
            filtered.map((region) => {
              const isSelected = selectedRegions.some(
                (selectedRegion) => selectedRegion.searchRegionId === region.countyID
              );
              return (
                <label
                  key={region.countyID}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors select-none",
                    "hover:bg-accent",
                    isSelected && "bg-primary/10"
                  )}
                >
                  {isSelected && (
                    <span className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" aria-hidden="true" />
                  )}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(region)}
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${region.countyName}`}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      isSelected ? "text-foreground font-semibold" : "text-foreground"
                    )}
                  >
                    {region.countyName}
                  </span>
                  <span
                    className="text-muted-foreground shrink-0 text-xs tabular-nums"
                    aria-label={`${region.numberPostings.toLocaleString()} postings`}
                  >
                    {region.numberPostings.toLocaleString()}
                  </span>
                </label>
              );
            })}
        </div>
      </ScrollArea>

      {selectedRegions.length > 0 && (
        <>
          <Separator />
          <div className="text-muted-foreground flex items-center gap-2 px-4 py-2.5 text-sm">
            <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {selectedRegions.length} region{selectedRegions.length !== 1 ? "s" : ""} selected — districts load below
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 3: District Selector (per region) ──────────────────────────────────

function DistrictGroup({
  allSelected,
  isInvalid,
  onDistrictCountChange,
  region,
  selectedDistricts,
  onToggleDistrict,
  onSelectAll,
  onDeselectAll
}: {
  allSelected: boolean;
  isInvalid: boolean;
  onDistrictCountChange: (count: number) => void;
  region: EdjoinSearchRegion;
  selectedDistricts: SelectedDistrictNode[];
  onToggleDistrict: (district: EdjoinDistrict) => void;
  onSelectAll: (all: EdjoinDistrict[]) => void;
  onDeselectAll: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const errorId = useId();

  const {
    data: districts = [],
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ["edjoin", "districts", String(region.countyID)],
    queryFn: () => loadEdjoinDistricts(String(region.countyID)),
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (!isLoading && !isError) {
      onDistrictCountChange(districts.length);
    }
  }, [districts.length, isError, isLoading, onDistrictCountChange]);

  const deferred = useDeferredValue(query);
  const trimmed = deferred.trim().toLowerCase();
  const filteredDistricts =
    query.length === 0
      ? districts
      : trimmed.length >= 2
        ? districts.filter((district) => district.districtName.toLowerCase().includes(trimmed))
        : districts;
  const showMinCharHint = trimmed.length > 0 && trimmed.length < 2;
  const visibleDistrictCount = Math.min(filteredDistricts.length, 5);
  const districtScrollHeightRem = visibleDistrictCount * DISTRICT_ROW_HEIGHT_REM + DISTRICT_SCROLL_PADDING_REM;

  return (
    <Accordion
      collapsible
      type="single"
      value={expanded ? "open" : undefined}
      onValueChange={(next) => setExpanded(next === "open")}
    >
      <AccordionItem className="last:border-b-0" value="open">
        <AccordionTrigger className="px-4" aria-describedby={isInvalid ? errorId : undefined}>
          <div className="flex w-full items-center gap-2.5 pr-2">
            <span className="text-foreground min-w-0 flex-1 truncate text-left text-sm font-semibold">
              {region.countyName}
            </span>
            {selectedDistricts.length > 0 ? (
              <Badge
                variant={allSelected ? "default" : "muted"}
                aria-label={`${selectedDistricts.length} of ${districts.length} districts selected`}
              >
                <span aria-hidden="true">
                  {allSelected ? "All" : `${selectedDistricts.length} / ${districts.length}`}
                </span>
              </Badge>
            ) : isInvalid ? (
              <Badge variant="destructive" aria-label="Selection required">
                <AlertCircle data-icon="inline-start" className="size-3" aria-hidden="true" />
                Required
              </Badge>
            ) : null}
            {isLoading && <Loader2 className="text-muted-foreground size-3.5 animate-spin" aria-hidden="true" />}
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-muted/20 pb-0">
          {isInvalid && !isLoading && !isError && (
            <>
              <Alert id={errorId} variant="destructive" className="m-3 mb-0">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>District selection required</AlertTitle>
                <AlertDescription>Select at least one district for {region.countyName}.</AlertDescription>
              </Alert>
              <Separator />
            </>
          )}

          {isLoading && (
            <div className="py-1">
              <LoadingRows rows={3} label={`Loading districts for ${region.countyName}`} />
            </div>
          )}

          {isError && (
            <ErrorState message={`Failed to load districts for ${region.countyName}.`} onRetry={() => void refetch()} />
          )}

          {!isLoading && !isError && districts.length === 0 && (
            <EmptyState message={`No districts found in ${region.countyName}.`} />
          )}

          {!isLoading && !isError && districts.length > 0 && (
            <>
              <div className="px-3 py-2">
                <div className="bg-background focus-within:border-ring focus-within:ring-ring/30 relative flex items-center rounded-md border px-2.5 focus-within:ring-2">
                  <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  <Input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter districts…"
                    className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 py-0 text-sm shadow-none focus-visible:ring-0"
                    aria-label={`Filter districts in ${region.countyName}`}
                  />
                  {query && (
                    <Button
                      type="button"
                      onClick={() => setQuery("")}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground size-6 rounded-sm"
                      aria-label="Clear filter"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 px-4 py-2">
                <Button
                  onClick={allSelected ? onDeselectAll : () => onSelectAll(districts)}
                  className="h-auto px-0 py-0 text-sm font-medium"
                  variant="link"
                >
                  {allSelected ? "Deselect all" : `Select all ${districts.length} districts`}
                </Button>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {selectedDistricts.length} of {districts.length} selected
                </span>
              </div>
              <Separator />

              {showMinCharHint ? (
                <p className="text-muted-foreground px-4 py-3 text-center text-sm">
                  Type at least 2 characters to filter.
                </p>
              ) : filteredDistricts.length === 0 ? (
                <EmptyState message={`No districts match "${query}"`} onClear={() => setQuery("")} />
              ) : (
                <ScrollArea
                  className="max-h-[calc(5*2.5rem+0.5rem)]"
                  style={{ height: `${districtScrollHeightRem}rem` }}
                >
                  <div className="py-1">
                    {filteredDistricts.map((district) => {
                      const isSelected = selectedDistricts.some(
                        (selectedDistrict) => selectedDistrict.districtId === district.districtID
                      );
                      return (
                        <label
                          key={district.districtID}
                          className={cn(
                            "relative flex cursor-pointer items-center gap-3 px-5 py-2 text-sm transition-colors select-none",
                            "hover:bg-accent",
                            isSelected && "bg-primary/10"
                          )}
                        >
                          {isSelected && (
                            <span className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" aria-hidden="true" />
                          )}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleDistrict(district)}
                            aria-label={`${isSelected ? "Deselect" : "Select"} ${district.districtName}`}
                          />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              isSelected ? "text-foreground font-medium" : "text-foreground"
                            )}
                          >
                            {district.districtName}
                          </span>
                          <span
                            className="text-muted-foreground shrink-0 text-xs tabular-nums"
                            aria-label={`${district.numberPostings.toLocaleString()} postings`}
                          >
                            {district.numberPostings.toLocaleString()}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ─── Summary Panel ───────────────────────────────────────────────────────────

function SummaryPanel({
  selection,
  onRemoveRegion,
  onClearAll
}: {
  selection: LocationSelection;
  onRemoveRegion: (countyID: number) => void;
  onClearAll: () => void;
}) {
  const regions = selection.state?.children ?? [];
  const totalDistricts = regions.reduce((sum, region) => sum + region.children.length, 0);
  const isEmpty = !selection.state && regions.length === 0;

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="text-primary size-4 shrink-0" aria-hidden="true" />
          <CardTitle className="truncate text-sm font-semibold">Selected Locations</CardTitle>
        </div>
        {regions.length > 0 && (
          <Button onClick={onClearAll} className="text-sm" variant="link" size="sm">
            Clear all
          </Button>
        )}
      </CardHeader>

      <Separator />
      <CardContent className="px-0 pb-0">
        {/* Live region announces every change */}
        <div role="status" aria-live="polite" className="sr-only">
          {isEmpty
            ? "No locations selected."
            : `${selection.state?.name ?? ""}, ${regions.length} ${regions.length === 1 ? "region" : "regions"}, ${totalDistricts} ${totalDistricts === 1 ? "district" : "districts"} selected.`}
        </div>

        {isEmpty && (
          <Empty className="border-0 px-4 py-10 shadow-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPinOff aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-medium">Pick a state to begin</EmptyTitle>
              <EmptyDescription className="max-w-[16rem] text-sm leading-relaxed">
                Choose a state, then add search regions and districts to build your export.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!isEmpty && (
          <div className="flex flex-col">
            {selection.state && (
              <div className="flex items-start gap-2.5 px-4 py-3">
                <MapIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">State</span>
                  <span className="text-foreground truncate text-sm font-medium">{selection.state.name}</span>
                </div>
              </div>
            )}

            {/* Regions */}
            {regions.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col">
                  {regions.map((region, idx) => {
                    const districtCount = region.children.length;
                    const total = region.totalDistrictCount;
                    const allSelected = total !== null && districtCount === total && total > 0;
                    return (
                      <div key={region.searchRegionId}>
                        {idx > 0 && <Separator />}
                        <div className="flex items-start gap-2.5 px-4 py-3">
                          <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                              Region
                            </span>
                            <span className="text-foreground truncate text-sm font-medium">{region.name}</span>
                            {districtCount > 0 && (
                              <Badge
                                variant={allSelected ? "default" : "secondary"}
                                className="w-fit"
                                aria-label={
                                  allSelected
                                    ? `All ${total} districts selected`
                                    : `${districtCount} of ${total ?? "?"} districts selected`
                                }
                              >
                                <span aria-hidden="true">
                                  {allSelected
                                    ? `All ${total} districts`
                                    : `${districtCount} ${total ? `of ${total}` : ""} ${
                                        districtCount === 1 ? "district" : "districts"
                                      }`}
                                </span>
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            onClick={() => onRemoveRegion(region.searchRegionId)}
                            aria-label={`Remove ${region.name}`}
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
                          >
                            <X aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Footer summary */}
            {totalDistricts > 0 && (
              <>
                <Separator />
                <div className="bg-muted/30 flex items-center justify-between gap-2 px-4 py-3">
                  <span className="text-muted-foreground text-sm">Total districts</span>
                  <span className="text-foreground text-sm font-semibold tabular-nums">{totalDistricts}</span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main LocationSelector ────────────────────────────────────────────────────

export function LocationSelector({ value, onChange, disabled, invalidRegionIds = [] }: LocationSelectorProps) {
  const state = value.state;
  const regions = state?.children ?? [];

  function handleStateChange(nextState: EdjoinState | null) {
    onChange(
      nextState
        ? {
            state: {
              children: [],
              name: nextState.fullname,
              stateId: nextState.stateID
            }
          }
        : { state: null }
    );
  }

  function handleRegionToggle(region: EdjoinSearchRegion) {
    if (!state) return;

    const exists = regions.some((selectedRegion) => selectedRegion.searchRegionId === region.countyID);
    if (exists) {
      onChange({
        state: {
          ...state,
          children: regions.filter((selectedRegion) => selectedRegion.searchRegionId !== region.countyID)
        }
      });
    } else {
      onChange({
        state: {
          ...state,
          children: [
            ...regions,
            {
              allSelected: false,
              children: [],
              name: region.countyName,
              searchRegionId: region.countyID,
              totalDistrictCount: null
            }
          ]
        }
      });
    }
  }

  function handleDistrictToggle(countyID: number, district: EdjoinDistrict) {
    if (!state) return;

    onChange({
      state: {
        ...state,
        children: regions.map((selectedRegion) => {
          if (selectedRegion.searchRegionId !== countyID) return selectedRegion;
          const exists = selectedRegion.children.some(
            (selectedDistrict) => selectedDistrict.districtId === district.districtID
          );
          const nextDistricts = exists
            ? selectedRegion.children.filter((selectedDistrict) => selectedDistrict.districtId !== district.districtID)
            : [...selectedRegion.children, { districtId: district.districtID, name: district.districtName }];
          return { ...selectedRegion, children: nextDistricts, allSelected: false };
        })
      }
    });
  }

  function handleSelectAllDistricts(countyID: number, allDistricts: EdjoinDistrict[]) {
    if (!state) return;

    onChange({
      state: {
        ...state,
        children: regions.map((selectedRegion) =>
          selectedRegion.searchRegionId === countyID
            ? {
                ...selectedRegion,
                allSelected: true,
                children: allDistricts.map((district) => ({
                  districtId: district.districtID,
                  name: district.districtName
                }))
              }
            : selectedRegion
        )
      }
    });
  }

  function handleDeselectAllDistricts(countyID: number) {
    if (!state) return;

    onChange({
      state: {
        ...state,
        children: regions.map((selectedRegion) =>
          selectedRegion.searchRegionId === countyID
            ? { ...selectedRegion, children: [], allSelected: false }
            : selectedRegion
        )
      }
    });
  }

  function handleDistrictCountChange(countyID: number, count: number) {
    if (!state) return;

    const hasCountChange = regions.some(
      (regionSelection) => regionSelection.searchRegionId === countyID && regionSelection.totalDistrictCount !== count
    );

    if (!hasCountChange) return;

    onChange({
      state: {
        ...state,
        children: regions.map((regionSelection) =>
          regionSelection.searchRegionId === countyID
            ? { ...regionSelection, totalDistrictCount: count }
            : regionSelection
        )
      }
    });
  }

  function handleRemoveRegion(countyID: number) {
    if (!state) return;

    onChange({
      state: {
        ...state,
        children: regions.filter((selectedRegion) => selectedRegion.searchRegionId !== countyID)
      }
    });
  }

  function handleClearAll() {
    if (!state) return;
    onChange({ state: { ...state, children: [] } });
  }

  const regionsLocked = !state;
  const districtsLocked = regions.length === 0;
  const totalSelectedDistricts = regions.reduce((sum, region) => sum + region.children.length, 0);
  const allRegionsHaveDistricts = regions.length > 0 && regions.every((region) => region.children.length > 0);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
      {/* Left: 3-step cards */}
      <div className={cn("flex min-w-0 flex-col gap-3", disabled && "pointer-events-none opacity-60")}>
        {/* Step 1: State */}
        <SectionCard
          step={1}
          completed={!!state}
          title="Select State"
          subtitle="Choose the state to scrape. Only one state is supported per export."
          locked={false}
        >
          <StateSelector value={state} onChange={handleStateChange} disabled={disabled} />
        </SectionCard>

        {/* Step 2: Search Regions */}
        <SectionCard
          step={2}
          completed={regions.length > 0}
          title="Select Search Regions"
          subtitle={
            regionsLocked
              ? "Select a state first to unlock search regions."
              : `Regions for ${state!.name}, loaded directly from EDJOIN.`
          }
          locked={regionsLocked}
        >
          {!regionsLocked && (
            <SearchRegionSelector
              stateId={String(state!.stateId)}
              selectedRegions={regions}
              onToggle={handleRegionToggle}
            />
          )}
        </SectionCard>

        {/* Step 3: Districts */}
        <SectionCard
          step={3}
          completed={totalSelectedDistricts > 0 && allRegionsHaveDistricts}
          title="Select Districts"
          subtitle={
            districtsLocked
              ? "Select at least one search region to load its districts."
              : "Districts are fetched per region. Choose at least one in each."
          }
          locked={districtsLocked}
        >
          {!districtsLocked && (
            <div className="flex flex-col">
              {regions.map((sel) => (
                <DistrictGroup
                  key={sel.searchRegionId}
                  allSelected={sel.allSelected}
                  isInvalid={invalidRegionIds.includes(String(sel.searchRegionId))}
                  onDistrictCountChange={(count) => handleDistrictCountChange(sel.searchRegionId, count)}
                  region={{
                    countyID: sel.searchRegionId,
                    countyName: sel.name,
                    numberPostings: 0,
                    state: state?.name ?? ""
                  }}
                  selectedDistricts={sel.children}
                  onToggleDistrict={(district) => handleDistrictToggle(sel.searchRegionId, district)}
                  onSelectAll={(all) => handleSelectAllDistricts(sel.searchRegionId, all)}
                  onDeselectAll={() => handleDeselectAllDistricts(sel.searchRegionId)}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Right: Summary */}
      <div className="lg:sticky lg:top-20">
        <SummaryPanel selection={value} onRemoveRegion={handleRemoveRegion} onClearAll={handleClearAll} />
      </div>
    </div>
  );
}

export type { EdjoinDistrict, EdjoinSearchRegion, EdjoinState };
