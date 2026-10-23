"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpIcon,
  CircleAlertIcon,
  SquareIcon,
  UploadIcon,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/files";
import type { IntegrationId } from "@/lib/mock-data";
import {
  EASE_DRAWER_VALUE,
  EASE_OUT_STRONG_VALUE,
  ENTER_ICON,
  ENTER_SCALE,
} from "@/lib/motion";

import { AddMenu } from "./add-menu";
import { AttachmentList } from "./attachment-list";
import { ConnectedApps } from "./connected-apps";
import { ModelPicker, type ModelPickerProps } from "./model-picker";
import type {
  ComposerActivity,
  ComposerAttachment,
  ComposerSubmission,
} from "./types";
import { useAttachments } from "./use-attachments";

export type ComposerProps = {
  /** Called with the trimmed message, finished attachments and model on send. */
  onSubmit: (submission: ComposerSubmission) => void;
  /**
   * What the conversation is doing. While sending, the send button shows
   * progress; while generating it becomes a stop button. Both block a second
   * submit, but typing and attaching stay available for the next message.
   */
  activity?: ComposerActivity;
  /** Interrupts the reply being generated. */
  onStop?: () => void;
  /** State and callbacks for the model picker in the footer. */
  modelPicker: Omit<ModelPickerProps, "disabled">;
  /**
   * Optional content rendered above the composer, as its own box. Receives
   * the live attachments so an upload can be traced from the moment a file
   * lands, before it is sent. Return a Frame, or null. It sits in a row at
   * least `--composer-top` tall, aligned to its bottom, so it grows upward
   * and the input below it stays put.
   */
  renderPanel?: (attachments: ComposerAttachment[]) => ReactNode;
  /** Blocks typing, attaching and sending entirely. */
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * The composer: a ReUI Frame (the outlined box) holding the attachment chips
 * when files are present and, below them, the input panel: a borderless
 * shadcn InputGroup with the auto-growing textarea and a footer carrying
 * the plus menu, the connected app marks, the model picker and the send/stop
 * button. Frame and panel radii come from the Nova preset.
 *
 * Files arrive three ways: Add files in the plus menu opens the native
 * picker, the whole composer is a drop target, and pasting files into the
 * textarea attaches them while plain text pastes are untouched. Enter sends,
 * Shift+Enter inserts a newline, Escape stops a running reply, and an
 * in-progress IME composition never sends.
 */
export function Composer({
  onSubmit,
  activity = "idle",
  onStop,
  modelPicker,
  renderPanel,
  disabled = false,
  placeholder = "Ask anything…",
  className,
}: ComposerProps) {
  // useId keeps the label and textarea paired even if two composers share a page.
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  /*
   * A focused text field always matches :focus-visible, so a ring keyed off
   * it would also appear on a mouse click. The last input method is tracked
   * instead, and the textarea only marks focus that arrived by keyboard.
   * Only Tab counts: Enter sends and the reply hands focus back, and that
   * is not navigation, so a mouse user never sees the ring.
   */
  const lastInput = useRef<"keyboard" | "pointer">("keyboard");
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Tab") lastInput.current = "keyboard";
    };
    const onPointer = () => {
      lastInput.current = "pointer";
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);
  const files = useAttachments({
    disabled,
    // A drop or a paste leaves focus wherever it was, often on the body.
    // Put it in the textarea so the next thing typed lands in the message
    // and Tab moves forward through the controls rather than back through
    // the chips.
    onFilesAdded: () => textareaRef.current?.focus(),
  });

  // Mocked: connecting an app only records it here, nothing is authenticated.
  const [connectedApps, setConnectedApps] = useState<IntegrationId[]>([]);
  function toggleApp(id: IntegrationId) {
    setConnectedApps((prev) =>
      prev.includes(id) ? prev.filter((app) => app !== id) : [...prev, id],
    );
  }

  const hasAttachments = files.attachments.length > 0;
  /*
   * Emptying the row removes its content, so 1fr resolves to zero before
   * the transition can run and the composer snaps shut. Whatever is about
   * to disappear is held here instead, giving the collapse something to
   * animate from, and cleared once it has finished.
   */
  const [lingering, setLingering] = useState<ComposerAttachment[]>([]);
  const rowAttachments = hasAttachments ? files.attachments : lingering;

  /*
   * The row under the input does the same: it stays mounted and animates
   * between zero and its content height, and whatever it last showed
   * lingers while it closes.
   */
  const hasFooterRow = connectedApps.length > 0 || files.rejections.length > 0;
  const [rowRejections, clearRejections] = useLingering(
    files.rejections,
    hasFooterRow,
  );
  const [rowApps, clearApps] = useLingering(connectedApps, hasFooterRow);

  /** Snapshot the row when an action is about to leave it empty. */
  function keepForCollapse() {
    if (files.attachments.length > 0) setLingering(files.attachments);
  }

  function handleRemove(fileId: string) {
    if (files.attachments.length === 1) keepForCollapse();
    files.remove(fileId);
  }
  const trimmed = text.trim();
  const hasContent = trimmed.length > 0 || files.attachments.length > 0;
  // Sending waits for every upload to finish; a failed upload has to be
  // retried or removed first so nothing half-attached leaves the composer.
  const canSubmit =
    hasContent &&
    !disabled &&
    activity === "idle" &&
    !files.isUploading &&
    !files.hasErrors;

  // Hand focus back to the textarea once a reply finishes or is stopped, so
  // the next message can be typed without reaching for the mouse.
  const previousActivity = useRef(activity);
  useEffect(() => {
    if (previousActivity.current !== "idle" && activity === "idle") {
      textareaRef.current?.focus();
    }
    previousActivity.current = activity;
  }, [activity]);

  const total = files.attachments.length;
  const failed = files.attachments.filter((item) => item.status === "error").length;
  const uploading = files.attachments.filter(
    (item) => item.status === "uploading",
  ).length;
  const summary =
    total === 0
      ? ""
      : uploading > 0
        ? `Uploading ${uploading} of ${total}`
        : failed > 0
          ? `${failed} of ${total} failed`
          : `${total} of ${files.maxFiles} attached`;

  /**
   * The textarea sizes itself from its content, so clearing the draft drops
   * it to one line in a single frame while the chip row eases shut beside
   * it. Growing while typing stays instant; only this one shrink animates.
   *
   * The height is pinned here, before the draft is cleared, so the collapsed
   * state is never painted. Two things have to be suspended for the pin to
   * hold: content sizing, which ignores an animated height, and the flex
   * rule, which otherwise decides the height itself. Both are released at
   * the end.
   */
  function collapseTextarea() {
    const el = textareaRef.current;
    if (!el) return;

    const release = () => {
      el.style.removeProperty("height");
      el.style.removeProperty("field-sizing");
      el.style.removeProperty("flex");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const from = el.getBoundingClientRect().height;
    const pin = (height: number) => {
      el.style.setProperty("field-sizing", "fixed");
      el.style.setProperty("flex", "none");
      el.style.height = `${height}px`;
    };
    pin(from);

    requestAnimationFrame(() => {
      // Release, measure and re-pin inside one frame: nothing is painted
      // between the three, so the box does not flicker.
      release();
      const to = el.getBoundingClientRect().height;
      if (from - to < 2) return;
      pin(to);
      const animation = el.animate(
        [{ height: `${from}px` }, { height: `${to}px` }],
        { duration: 220, easing: EASE_DRAWER_VALUE },
      );
      animation.finished.then(release, release);
    });
  }

  function submit() {
    if (!canSubmit) return;
    keepForCollapse();
    onSubmit({
      text: trimmed,
      attachments: files.detach(),
      modelId: modelPicker.value,
      connectedApps,
    });
    // Pin before clearing, so the shrink is animated rather than painted.
    collapseTextarea();
    setText("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && activity === "generating") {
      event.preventDefault();
      onStop?.();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    // While an IME is composing (e.g. Japanese input), Enter confirms the
    // candidate rather than sending the message.
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <div
      className={cn(
        "grid grid-rows-[minmax(var(--composer-top,0px),auto)_auto] gap-3",
        className,
      )}
    >
      <div className="flex min-h-0 flex-col justify-end gap-3">
        {renderPanel?.(files.attachments)}
      </div>
      <form
        onSubmit={handleSubmit}
        className="relative"
        {...files.dropZoneProps}
      >
        <Field>
          <FieldLabel htmlFor={id} className="sr-only">
            Message
          </FieldLabel>
          {/*
            The Frame is the outer box: it holds the chips, the input panel
            and the rejection badges, and carries the drop highlight and the
            dim state.
          */}
          <Frame
            spacing="sm"
            className={cn(
              "gap-0 transition-[border-color,box-shadow]",
              disabled && "opacity-50",
              files.isDragging && "border-primary ring-3 ring-primary/20",
            )}
          >
            {/*
              The chip row stays mounted and animates between zero and its
              content height, so the composer grows and shrinks instead of
              jumping. grid-template-rows interpolates 0fr to 1fr without
              anyone having to measure the content.

              Closing stays a little quicker than opening, but rides the
              drawer curve so it eases out of the motion instead of
              stopping dead.
            */}
            <div
              className="grid transition-[grid-template-rows] motion-reduce:transition-none"
              onTransitionEnd={(event) => {
                if (
                  event.propertyName === "grid-template-rows" &&
                  !hasAttachments
                ) {
                  setLingering([]);
                }
              }}
              style={{
                gridTemplateRows: hasAttachments ? "1fr" : "0fr",
                transitionDuration: hasAttachments ? "260ms" : "220ms",
                transitionTimingFunction: hasAttachments
                  ? EASE_OUT_STRONG_VALUE
                  : EASE_DRAWER_VALUE,
              }}
            >
              {/* inert once closed: the chips linger in the DOM to give the
                  collapse something to animate, but they are gone as far as
                  the keyboard and a screen reader are concerned. */}
              <div className="overflow-hidden" inert={!hasAttachments}>
                {/* The gap below the chips travels with them, so it
                    disappears as the row closes. */}
                <div className="pb-(--frame-gap)">
                  <AttachmentList
                    attachments={rowAttachments}
                    onRemove={handleRemove}
                    onRetry={files.retry}
                  />
                </div>
              </div>
            </div>
            {/*
              The input sits in its own panel inside the frame, so the box
              reads as a field within the composer. The InputGroup itself
              gives up its border, background and focus ring to the panel.
            */}
            {/* The textarea gives up its own focus ring (below), so the panel
                around it carries the field focus treatment instead, for
                keyboard focus only. */}
            <FramePanel className="p-0 has-[[data-slot=input-group-control][data-keyboard-focus]]:border-ring has-[[data-slot=input-group-control][data-keyboard-focus]]:ring-3 has-[[data-slot=input-group-control][data-keyboard-focus]]:ring-ring/50">
              <InputGroup className="rounded-none border-0 bg-transparent has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-transparent dark:has-disabled:bg-transparent">
            <InputGroupTextarea
              ref={textareaRef}
              id={id}
              name="message"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (files.rejections.length > 0) files.dismissRejections();
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setKeyboardFocus(lastInput.current === "keyboard")}
              onBlur={() => setKeyboardFocus(false)}
              data-keyboard-focus={keyboardFocus || undefined}
              onPaste={files.onPaste}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="max-h-48 min-h-10 px-3.5 py-3 text-sm leading-relaxed md:text-sm"
            />

            <InputGroupAddon align="block-end" className="gap-1 px-2 pb-2">
              <AddMenu
                onAddFiles={files.openFileDialog}
                filesFull={files.isFull}
                connected={connectedApps}
                onToggle={toggleApp}
                disabled={disabled}
              />
              {summary ? (
                <InputGroupText className="text-xs tabular-nums">
                  {summary}
                </InputGroupText>
              ) : null}

              <div className="ms-auto flex items-center gap-1">
                <ModelPicker {...modelPicker} disabled={disabled} />
                {/*
                  Send and stop share one slot, size and colour, so the swap
                  never moves the footer: only the glyph changes.
                */}
                {activity === "generating" ? (
                  <InputGroupButton
                    type="button"
                    variant="default"
                    size="icon-sm"
                    aria-label="Stop generating"
                    onClick={onStop}
                    className="rounded-full"
                  >
                    <SquareIcon className={cn("size-3 fill-current", ENTER_ICON)} />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    aria-label={
                      activity === "sending" ? "Sending message" : "Send message"
                    }
                    aria-busy={activity === "sending"}
                    disabled={!canSubmit}
                    className="rounded-full"
                  >
                    {activity === "sending" ? (
                      <Spinner aria-hidden="true" role="presentation" />
                    ) : (
                      <ArrowUpIcon className={ENTER_ICON} />
                    )}
                  </InputGroupButton>
                )}
              </div>
            </InputGroupAddon>
              </InputGroup>
            </FramePanel>

            {/*
              The row under the input, inside the frame: any rejected files
              on the left as badges (dark orange on a light orange fill,
              cleared as soon as the user types or attaches again) and the
              connected app marks on the right.
            */}
            <div
              className="grid transition-[grid-template-rows] motion-reduce:transition-none"
              onTransitionEnd={(event) => {
                if (
                  event.propertyName === "grid-template-rows" &&
                  !hasFooterRow
                ) {
                  clearRejections();
                  clearApps();
                }
              }}
              style={{
                gridTemplateRows: hasFooterRow ? "1fr" : "0fr",
                transitionDuration: hasFooterRow ? "260ms" : "220ms",
                transitionTimingFunction: hasFooterRow
                  ? EASE_OUT_STRONG_VALUE
                  : EASE_DRAWER_VALUE,
              }}
            >
              <div className="overflow-hidden" inert={!hasFooterRow}>
                <div
                  // The gap above travels with the row, so it goes as the row
                  // closes. p-1 on top of the frame s own 3px inset puts the
                  // content 7px from every edge: the horizontal spacing it
                  // already had, now matched vertically.
                  className="mt-(--frame-gap) flex flex-wrap items-center gap-1 p-1"
                >
                  {rowRejections.length > 0 ? (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-1"
                    >
                      {rowRejections.map((message) => (
                        <Badge
                          key={message}
                          variant="warning-light"
                          size="xl"
                          className={cn(
                            // h-auto: the badge size sets a fixed height, which a
                            // wrapped message would spill out of and over the one
                            // below it.
                            "h-auto max-w-full rounded-md border-transparent py-1 whitespace-normal wrap-break-word",
                            ENTER_SCALE,
                          )}
                        >
                          <CircleAlertIcon aria-hidden="true" />
                          {message}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <ConnectedApps connected={rowApps} className="ms-auto" />
                </div>
              </div>
            </div>

            {files.isDragging ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] bg-background/85 text-sm font-medium backdrop-blur-sm"
              >
                <UploadIcon className="size-4" />
                Drop files to attach
                <span className="text-muted-foreground">
                  · up to {files.maxFiles} files, {formatBytes(files.maxBytes)} each
                </span>
              </div>
            ) : null}
          </Frame>
        </Field>

        <input {...files.getInputProps()} aria-label="Attach files" />

        {/* The footer summary lives in composer chrome nothing announces, so a
            live region repeats it for screen readers as uploads progress. */}
        <span className="sr-only" aria-live="polite">
          {summary}
        </span>
      </form>

    </div>
  );
}

/**
 * The last non-empty `items`, held while the row is closed so it has content
 * to animate from; `clear` drops it once the row has closed. While the row is
 * open, `items` is shown as is, even when empty: the row may be open for its
 * other content, and a held copy would otherwise outlive its dismissal.
 * Snapshotted while rendering rather than in an effect: the copy has to be
 * current before the frame in which the content clears. `items` must be
 * referentially stable between renders (state, not a fresh array).
 */
function useLingering<T>(items: T[], open: boolean): [T[], () => void] {
  const [kept, setKept] = useState(items);
  if (items.length > 0 && kept !== items) setKept(items);
  return [open ? items : kept, () => setKept([])];
}
