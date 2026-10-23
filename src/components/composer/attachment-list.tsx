"use client";

import { useEffect, useRef } from "react";
import { CircleAlertIcon, RotateCwIcon, XIcon } from "lucide-react";
import { cn } from "cn";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { formatBytes } from "@/lib/files";
import { ENTER_SCALE } from "@/lib/motion";

import { FileTypeIcon, getFileKind } from "./file-type-icon";
import type { ComposerAttachment } from "./types";

type AttachmentListProps = {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

function describe(item: ComposerAttachment) {
  switch (item.status) {
    case "uploading":
      return `Uploading ${Math.round(item.progress * 100)}%`;
    case "error":
      return item.error ?? "Upload failed";
    case "done":
      return `${getFileKind(item.type, item.name).label} · ${formatBytes(item.size)}`;
  }
}

/** Chips fade and settle rather than snapping in. */
const CHIP_ENTER = ENTER_SCALE;

/**
 * The media box sits 7px inside the chip edge (padding plus border), so its
 * radius is the chip radius minus that inset: the curves stay concentric.
 */
const MEDIA_RADIUS = "rounded-[calc(var(--frame-panel-radius)-7px)]";

/**
 * The Attachment primitive paints its error state in the destructive red.
 * A failed upload here looks like the rejection badge instead: a light
 * warning fill over the whole chip, no border, dark warning text and icon.
 */
const WARNING_CHIP =
  "data-[state=error]:border-transparent data-[state=error]:bg-warning/10 data-[state=error]:text-warning-foreground";
const WARNING_MEDIA =
  "group-data-[state=error]/attachment:bg-transparent group-data-[state=error]/attachment:text-warning-foreground";
const WARNING_TEXT =
  "group-data-[state=error]/attachment:text-warning-foreground";
/**
 * The ghost Button paints hover grey with a near-black glyph. On a failed
 * chip the retry and remove controls keep the warning glyph instead, over a
 * soft warning tint that still reads against the chip's own 10% fill.
 */
const WARNING_ACTION = cn(
  WARNING_TEXT,
  "group-data-[state=error]/attachment:hover:bg-warning/20 group-data-[state=error]/attachment:hover:text-warning-foreground",
);

type AttachmentChipProps = {
  item: ComposerAttachment;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

function AttachmentChip({ item, onRemove, onRetry }: AttachmentChipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const uploading = item.status === "uploading";

  // The strip scrolls sideways, so a chip the user just added, or one that
  // has just failed and is blocking send, is brought into view rather than
  // left hidden off the end.
  useEffect(() => {
    if (item.status !== "error" && item.progress > 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  }, [item.status, item.progress]);

  return (
    <Attachment
      ref={ref}
      role="listitem"
      size="sm"
      state={item.status}
      // Same radius as the input panel the chips sit above, so the chips read
      // as part of the same frame.
      className={cn(
        "max-w-56 overflow-hidden rounded-(--frame-panel-radius)",
        CHIP_ENTER,
        WARNING_CHIP,
      )}
    >
      {item.previewUrl ? (
        <AttachmentMedia variant="image" className={MEDIA_RADIUS}>
          {/* Object URLs are local blobs, which next/image cannot optimise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt="" width={32} height={32} />
        </AttachmentMedia>
      ) : item.status === "error" ? (
        <AttachmentMedia className={cn(MEDIA_RADIUS, WARNING_MEDIA)}>
          <CircleAlertIcon aria-hidden="true" />
        </AttachmentMedia>
      ) : (
        /* The file-type icon shows throughout the upload; the shimmering
           title and the progress bar already say it is moving. */
        <AttachmentMedia className={MEDIA_RADIUS}>
          <FileTypeIcon type={item.type} name={item.name} className="size-5" />
        </AttachmentMedia>
      )}

      <AttachmentContent>
        <AttachmentTitle title={item.name}>{item.name}</AttachmentTitle>
        <AttachmentDescription className={WARNING_TEXT}>
          {describe(item)}
        </AttachmentDescription>
      </AttachmentContent>

      <AttachmentActions>
        {item.status === "error" ? (
          <AttachmentAction
            type="button"
            aria-label={`Retry ${item.name}`}
            onClick={() => onRetry(item.id)}
            className={WARNING_ACTION}
          >
            <RotateCwIcon aria-hidden="true" />
          </AttachmentAction>
        ) : null}
        <AttachmentAction
          type="button"
          aria-label={
            uploading ? `Cancel upload of ${item.name}` : `Remove ${item.name}`
          }
          onClick={() => onRemove(item.id)}
          className={WARNING_ACTION}
        >
          <XIcon aria-hidden="true" />
        </AttachmentAction>
      </AttachmentActions>

    </Attachment>
  );
}

/**
 * The tray of chips above the textarea. Each chip carries its own upload
 * state through the shadcn Attachment primitive: a shimmering title and a
 * counting percentage while uploading, a warning tint plus retry on failure.
 */
export function AttachmentList({
  attachments,
  onRemove,
  onRetry,
}: AttachmentListProps) {
  return (
    <AttachmentGroup
      role="list"
      aria-label="Attached files"
      /*
       * No padding of its own: inside the composer frame the chips sit flush
       * with the input panel, sharing the frame inset. The gap between chips
       * is the frames own gap token, so the space between two chips matches
       * the space around the row rather than being a second, larger value.
       * Everything governing the scroll is left untouched.
       */
      className="w-full gap-(--frame-gap) py-0 scroll-px-0"
    >
      {attachments.map((item) => (
        <AttachmentChip
          key={item.id}
          item={item}
          onRemove={onRemove}
          onRetry={onRetry}
        />
      ))}
    </AttachmentGroup>
  );
}
