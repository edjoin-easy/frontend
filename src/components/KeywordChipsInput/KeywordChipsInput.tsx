import { Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface KeywordChipsInputProps {
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  disabled?: boolean;
  id: string;
  onChange: (next: string[]) => void;
  placeholder?: string;
  value: string[];
}

/**
 * Multi-value input that renders each entry as a removable chip.
 *
 * Commit triggers (in priority order):
 *   • Enter
 *
 * Backspace on an empty input removes the last chip, matching the de-facto
 * pattern users expect from email/tag inputs (Gmail recipients, GitHub labels, etc.).
 */
export function KeywordChipsInput({
  ariaDescribedBy,
  ariaLabelledBy,
  disabled,
  id,
  onChange,
  placeholder,
  value
}: KeywordChipsInputProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const liveRegionId = useId();
  const [liveMessage, setLiveMessage] = useState("");
  const pendingKeyword = query.trim().replace(/,+$/, "").trim();
  const hasPendingKeyword = pendingKeyword.length > 0;
  const hasDuplicatePendingKeyword = value.some((kw) => kw.toLowerCase() === pendingKeyword.toLowerCase());

  function focusInput() {
    inputRef.current?.focus();
  }

  function commit(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, "").trim();
    if (!trimmed) {
      return;
    }
    // Case-insensitive de-dupe; preserve the user's original casing on the
    // first occurrence rather than forcing lowercase.
    const exists = value.some((kw) => kw.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setQuery("");
      setLiveMessage(`"${trimmed}" is already in the list.`);
      return;
    }
    onChange([...value, trimmed]);
    setQuery("");
    setLiveMessage(`Added ${trimmed}.`);
  }

  function removeAt(index: number) {
    const removed = value[index];
    onChange(value.filter((_, i) => i !== index));
    if (removed) {
      setLiveMessage(`Removed ${removed}.`);
    }
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Always swallow Enter inside a chips input — submitting the form
      // mid-typing is almost never what the user means.
      event.preventDefault();
      commit(query);
      return;
    }

    if (event.key === "Backspace" && query.length === 0 && value.length > 0) {
      event.preventDefault();
      removeAt(value.length - 1);
      return;
    }
  }

  return (
    <>
      <TooltipProvider>
        <div
          // Click anywhere in the container (gaps between chips, padding) to focus the input.
          onClick={focusInput}
          className={cn(
            "border-input bg-background flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm transition-colors",
            "focus-within:border-primary focus-within:ring-primary/20 focus-within:ring-2",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {value.map((keyword, idx) => (
            <span
              key={`${keyword}-${idx}`}
              className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-medium"
            >
              <span className="max-w-[16rem] truncate">{keyword}</span>
              <Button
                type="button"
                aria-label={`Remove ${keyword}`}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
                size="icon"
                variant="ghost"
                className="hover:bg-foreground/10 size-4 rounded-sm p-0"
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            </span>
          ))}

          <input
            ref={inputRef}
            id={id}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={value.length === 0 ? placeholder : ""}
            aria-describedby={ariaDescribedBy}
            aria-labelledby={ariaLabelledBy}
            className={cn(
              "placeholder:text-muted-foreground text-foreground min-w-[8rem] flex-1 bg-transparent py-0.5 outline-none",
              "disabled:cursor-not-allowed"
            )}
          />

          {hasPendingKeyword && !hasDuplicatePendingKeyword && !disabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label={`Add keyword ${pendingKeyword}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    commit(query);
                  }}
                  className="size-6 shrink-0 rounded-md"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add keyword or press Enter</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {/* Polite live region for AT users so chip add/remove is announced */}
      <span id={liveRegionId} role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </>
  );
}
