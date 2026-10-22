"use client";

import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type CopyButtonProps = {
  /** The text to put on the clipboard. */
  value: string;
  /** What is being copied, for the tooltip and label, e.g. "reply". */
  label?: string;
};

/**
 * Copy button after ReUI's c-button-42: an icon button with a tooltip, on
 * ReUI's use-copy-to-clipboard hook, that flips to a check for a moment.
 * The label flips too, so the state is announced, not just drawn.
 */
export function CopyButton({ value, label = "text" }: CopyButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 1500 });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={isCopied ? `Copied ${label}` : `Copy ${label}`}
            onClick={() => copyToClipboard(value)}
          >
            {isCopied ? (
              <CheckIcon aria-hidden="true" />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
          </Button>
        }
      />
      <TooltipContent>{isCopied ? "Copied" : `Copy ${label}`}</TooltipContent>
    </Tooltip>
  );
}
