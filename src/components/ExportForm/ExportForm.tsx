import { valibotResolver } from "@hookform/resolvers/valibot";
import { Download, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import * as v from "valibot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle
} from "@/components/ui/field";
import { KeywordChipsInput } from "../KeywordChipsInput/KeywordChipsInput";
import {
  LocationSelector,
  type LocationSelection,
  type SelectedDistrictNode,
  type SelectedSearchRegionNode,
  type SelectedStateNode
} from "../LocationSelector/LocationSelector";

// ─── Schema ──────────────────────────────────────────────────────────────────

const districtSchema = v.object({
  districtId: v.number(),
  name: v.string()
});

const searchRegionSchema = v.object({
  children: v.array(districtSchema),
  name: v.string(),
  searchRegionId: v.number()
});

const stateSchema = v.object({
  children: v.array(searchRegionSchema),
  name: v.string(),
  stateId: v.number()
});

const exportFormSchema = v.object({
  includeKeywords: v.array(v.string()),
  excludeKeywords: v.array(v.string()),
  state: v.nullable(stateSchema)
});

export type ExportFormValues = v.InferInput<typeof exportFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportFormProps {
  isLoading: boolean;
  onSubmit: (values: ExportFormValues) => void | Promise<void>;
}

interface RegionUiState {
  allSelected: boolean;
  totalDistrictCount: number | null;
}

function toStoredState(selection: LocationSelection["state"]): ExportFormValues["state"] {
  if (!selection) {
    return null;
  }

  return {
    children: selection.children.map((region) => ({
      children: region.children.map((district) => ({
        districtId: district.districtId,
        name: district.name
      })),
      name: region.name,
      searchRegionId: region.searchRegionId
    })),
    name: selection.name,
    stateId: selection.stateId
  };
}

function toSelectorSelection(
  state: ExportFormValues["state"],
  regionUiState: Record<number, RegionUiState>
): LocationSelection {
  if (!state) {
    return { state: null };
  }

  return {
    state: {
      children: state.children.map(
        (region): SelectedSearchRegionNode => ({
          allSelected: regionUiState[region.searchRegionId]?.allSelected ?? false,
          children: region.children.map(
            (district): SelectedDistrictNode => ({
              districtId: district.districtId,
              name: district.name
            })
          ),
          name: region.name,
          searchRegionId: region.searchRegionId,
          totalDistrictCount: regionUiState[region.searchRegionId]?.totalDistrictCount ?? null
        })
      ),
      name: state.name,
      stateId: state.stateId
    } satisfies SelectedStateNode
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportForm({ isLoading, onSubmit }: ExportFormProps) {
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [regionUiState, setRegionUiState] = useState<Record<number, RegionUiState>>({});
  const { control, handleSubmit, setValue } = useForm<ExportFormValues>({
    defaultValues: {
      includeKeywords: [],
      excludeKeywords: [],
      state: null
    },
    resolver: valibotResolver(exportFormSchema)
  });

  const storedState = useWatch({
    control,
    name: "state"
  });
  const locationSelection = toSelectorSelection(storedState, regionUiState);

  // Only districts are valid export targets.
  // A selected region without districts is an incomplete selection and should not validate.
  const selectedRegions = locationSelection.state?.children ?? [];
  const incompleteRegionIds = selectedRegions
    .filter((region) => region.children.length === 0)
    .map((region) => String(region.searchRegionId));
  const locationIds = selectedRegions.flatMap((region) =>
    region.children.map((district) => String(district.districtId))
  );
  const hasNoSelections = locationIds.length === 0;
  const hasIncompleteSelections = incompleteRegionIds.length > 0;
  const canSubmit = !hasNoSelections && !hasIncompleteSelections && !isLoading;
  const invalidRegionIds = hasTriedSubmit ? incompleteRegionIds : [];

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setHasTriedSubmit(true);
        if (hasNoSelections || hasIncompleteSelections) {
          return;
        }
        await onSubmit(values);
      })}
      className="flex flex-col gap-6"
      aria-label="Export search parameters"
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={(hasTriedSubmit && (hasNoSelections || hasIncompleteSelections)) || undefined}>
          <FieldContent>
            <FieldTitle className="text-lg font-semibold tracking-tight">
              Location
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
              <span className="sr-only">(required)</span>
            </FieldTitle>
            <FieldDescription>Select a state, then add regions and districts.</FieldDescription>
            <LocationSelector
              value={locationSelection}
              onChange={(next) => {
                setRegionUiState(
                  Object.fromEntries(
                    (next.state?.children ?? []).map((region) => [
                      region.searchRegionId,
                      {
                        allSelected: region.allSelected,
                        totalDistrictCount: region.totalDistrictCount
                      }
                    ])
                  )
                );
                setValue("state", toStoredState(next.state), { shouldDirty: true });
              }}
              disabled={isLoading}
              invalidRegionIds={invalidRegionIds}
            />
            {!isLoading && hasTriedSubmit && hasIncompleteSelections && !hasNoSelections ? (
              <FieldError>
                {`Select districts for ${incompleteRegionIds.length} region${incompleteRegionIds.length === 1 ? "" : "s"} above.`}
              </FieldError>
            ) : null}
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldTitle className="text-lg font-semibold tracking-tight">
              Keyword Filters
              <span className="text-muted-foreground ml-2 text-sm font-normal">Optional</span>
            </FieldTitle>
            <FieldDescription>Narrow results by job title or description.</FieldDescription>
            <Card className="shadow-xs">
              <CardContent className="flex flex-col gap-5 p-5">
                <Field>
                  <FieldContent>
                    <FieldLabel htmlFor="include-keywords">Include keywords</FieldLabel>
                    <Controller
                      control={control}
                      name="includeKeywords"
                      render={({ field }) => (
                        <KeywordChipsInput
                          id="include-keywords"
                          ariaDescribedBy="include-keywords-hint"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isLoading}
                          placeholder="Type a keyword and press Enter"
                        />
                      )}
                    />
                    <FieldDescription id="include-keywords-hint">
                      Press Enter to add. Backspace removes the last keyword.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldContent>
                    <FieldLabel htmlFor="exclude-keywords">Exclude keywords</FieldLabel>
                    <Controller
                      control={control}
                      name="excludeKeywords"
                      render={({ field }) => (
                        <KeywordChipsInput
                          id="exclude-keywords"
                          ariaDescribedBy="exclude-keywords-hint"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isLoading}
                          placeholder="Type a keyword and press Enter"
                        />
                      )}
                    />
                    <FieldDescription id="exclude-keywords-hint">
                      Listings matching any of these will be filtered out.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              </CardContent>
            </Card>
          </FieldContent>
        </Field>
      </FieldGroup>

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {!isLoading && hasTriedSubmit && hasNoSelections ? (
          <Alert variant="destructive" aria-live="polite">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>No locations selected</AlertTitle>
            <AlertDescription>
              Choose a state, then add the regions and at least one district you want to export.
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="default" disabled={!canSubmit} className="h-12 w-full text-sm font-semibold">
          {isLoading ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
              <span>Generating Excel export…</span>
            </>
          ) : (
            <>
              <Download data-icon="inline-start" aria-hidden="true" />
              <span>Generate Excel export</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
