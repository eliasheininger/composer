"use client";

import { ChevronDownIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";

import { EASE_OUT_STRONG } from "@/lib/motion";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ClaudeAiIcon } from "@/components/ui/svgs/claudeAiIcon";
import { Gemini } from "@/components/ui/svgs/gemini";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";
import type { Model, ModelProvider } from "@/lib/mock-data";

export type ModelPickerStatus = "loading" | "ready" | "error";

export type ModelPickerProps = {
  models: Model[];
  value: string;
  onChange: (modelId: string) => void;
  status: ModelPickerStatus;
  onRetry: () => void;
  disabled?: boolean;
};

type ProviderIconProps = {
  provider: ModelProvider;
  className?: string;
};

/** Provider logos from the ReUI model selector block, sized for menu rows. */
export function ProviderIcon({ provider, className }: ProviderIconProps) {
  const classes = cn("size-4 shrink-0", className);
  switch (provider) {
    case "anthropic":
      return <ClaudeAiIcon className={classes} aria-hidden="true" />;
    case "google":
      return <Gemini className={classes} aria-hidden="true" />;
    case "openai":
      return (
        <>
          <Openai className={cn(classes, "dark:hidden")} aria-hidden="true" />
          <OpenaiDark
            className={cn(classes, "hidden dark:block")}
            aria-hidden="true"
          />
        </>
      );
  }
}

/**
 * Model picker on the ReUI dropdown-menu model selector (c-dropdown-menu-18),
 * using a radio group so the current model carries a checkmark and the menu
 * gets arrow-key, type-ahead and Escape handling from the primitive.
 */
export function ModelPicker({
  models,
  value,
  onChange,
  status,
  onRetry,
  disabled = false,
}: ModelPickerProps) {
  const selected = models.find((model) => model.id === value);
  const label =
    status === "loading"
      ? "Loading models"
      : status === "error"
        ? "Models unavailable"
        : (selected?.name ?? "Choose model");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || status === "loading"}
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Model: ${label}`}
            aria-busy={status === "loading"}
            // h-8 to match the icon buttons beside it: the sm size is 28px,
            // which left the hover pill visibly shorter than send and attach.
            className="h-8 rounded-full text-sm"
          >
            {status === "loading" ? (
              <Spinner className="size-3.5" aria-hidden="true" role="presentation" />
            ) : status === "error" ? (
              <TriangleAlertIcon
                className="text-warning-foreground"
                aria-hidden="true"
              />
            ) : selected ? (
              <ProviderIcon provider={selected.provider} />
            ) : null}
            <span
              className={cn(
                "max-w-36 truncate",
                status !== "ready" && "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {/* Points up while the menu is open, so the trigger says which
                way the next click goes. 150ms keeps it with the menu, which
                opens in 100ms. */}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                "text-muted-foreground transition-transform duration-150 group-aria-expanded/button:rotate-180 motion-reduce:transition-none",
                EASE_OUT_STRONG,
              )}
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {status === "error" ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Models could not be loaded</DropdownMenuLabel>
            <DropdownMenuItem onClick={onRetry}>
              <RotateCwIcon aria-hidden="true" />
              Try again
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onChange(String(next))}
          >
            <DropdownMenuLabel>Model</DropdownMenuLabel>
            {models.map((model) => (
              <DropdownMenuRadioItem
                key={model.id}
                value={model.id}
                // Radio items stay open on select by default (built for
                // multi-toggle menus); a model picker should close on pick.
                closeOnClick
              >
                <ProviderIcon provider={model.provider} />
                <span className="truncate font-medium">{model.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
