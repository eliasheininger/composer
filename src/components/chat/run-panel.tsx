"use client";

import { useState } from "react";
import {
  FileSearchIcon,
  RotateCwIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";

import { Frame } from "@/components/reui/frame";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { formatBytes } from "@/lib/files";
import { pickReply } from "@/lib/mock-data";
import type { ProcessingStage } from "@/lib/mock-api";
import { EASE_OUT_STRONG, ENTER_SLIDE } from "@/lib/motion";

import { CopyButton } from "./copy-button";
import type { AssistantMessage, UserMessage } from "./types";

/**
 * The trigger's own chevron is a direct child, so it can be pinned to the
 * muted grey every other chevron uses while the line text still carries the
 * warning colour. The line's leading icon is nested deeper and keeps it.
 */
const TRIGGER_CHEVRON = "*:data-[slot=trace-icon]:text-muted-foreground";

/** Each step slides in when it starts, so the trace grows rather than appears. */
const ENTER = ENTER_SLIDE;

type RunPanelProps = {
  /** The user turn still being delivered, or one that failed. */
  pendingSend: UserMessage | null;
  reply: AssistantMessage | null;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
};

/**
 * What sits above the composer: once a message is sent, the trace of the
 * files being read, in a single bordered box, and the reply, which flows
 * free with no box around it. While composing there is nothing here; the
 * chips in the composer carry the upload.
 */
export function RunPanel({
  pendingSend,
  reply,
  onRetry,
  onDiscard,
}: RunPanelProps) {
  const trace = buildTrace(pendingSend, reply);
  const failedSend = pendingSend?.status === "failed" ? pendingSend : null;
  const showReply = reply !== null && reply.status !== "processing";
  /*
   * A message with no files has no trace to show, so without this the box
   * would stay empty for the length of the send and the thinking line would
   * arrive late. The text is the one the reply will use, so the line does
   * not change when delivery completes.
   */
  const waitingFor =
    pendingSend?.status === "sending" && pendingSend.attachments.length === 0
      ? pickReply(pendingSend.text).thinking
      : null;

  if (!trace && !failedSend && !showReply && !waitingFor) return null;

  return (
    // One border around the whole run: the trace and the reply it produced
    // belong to the same exchange, so they share a box.
    <>
      {/* One border, drawn by the Frame itself: the trace sits directly
          inside it rather than in a nested panel. */}
      {trace ? (
        <Frame
          spacing="sm"
          className={cn("bg-card px-3 py-2.5 text-sm", ENTER)}
        >
          <FileTrace trace={trace} />
        </Frame>
      ) : null}
      {/* The reply is not a card: it flows between the trace and the
          composer, with the page as its background. */}
      {failedSend || showReply || waitingFor ? (
        <div className={cn("px-1 text-sm", ENTER)}>
          {failedSend ? (
            <FailedSendNotice
              message={failedSend}
              onRetry={onRetry}
              onDiscard={onDiscard}
            />
          ) : showReply ? (
            <ReplyPreview message={reply} />
          ) : waitingFor ? (
            <ThinkingLine text={waitingFor} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Trace model. The chips already show the upload, so the trace only starts
// once the message is sent and covers the reading of the files.
// ---------------------------------------------------------------------------

type TraceFile = {
  id: string;
  name: string;
  size: number;
  /** Percent read so far. */
  read: number;
};

type TraceModel = {
  files: TraceFile[];
  stage: ProcessingStage;
  stopped: boolean;
  /** The message is still on its way; reading has not begun. */
  queued: boolean;
};

function buildTrace(
  pendingSend: UserMessage | null,
  reply: AssistantMessage | null,
): TraceModel | null {
  if (reply?.processing) {
    const { files, progress, stage } = reply.processing;
    return {
      files: files.map((file, index) => ({ ...file, read: progress[index] })),
      stage,
      stopped: reply.status === "stopped",
      queued: false,
    };
  }
  /*
   * The trace appears the moment the send button changes, not when reading
   * starts. During delivery the step is listed but dimmed, so the box does
   * not pop in a beat later with everything already running.
   */
  if (pendingSend?.status === "sending" && pendingSend.attachments.length > 0) {
    return {
      files: pendingSend.attachments.map(({ id, name, size }) => ({
        id,
        name,
        size,
        read: 0,
      })),
      stage: "reading",
      stopped: false,
      queued: true,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type FailedSendNoticeProps = {
  message: UserMessage;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
};

function FailedSendNotice({
  message,
  onRetry,
  onDiscard,
}: FailedSendNoticeProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="text-warning-foreground">Message not sent</span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onRetry(message.id)}
      >
        <RotateCwIcon data-icon="inline-start" />
        Retry
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onDiscard(message.id)}
      >
        <Trash2Icon data-icon="inline-start" />
        Discard
      </Button>
    </div>
  );
}

/** Built once: constructing a formatter per render is needlessly costly. */
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

/** The waiting row, shown from the moment a message is sent. */
function ThinkingLine({ text }: { text: string }) {
  /*
   * Deliberately the same shell as the reply it becomes: once the message is
   * accepted this row is replaced by ReplyPreview, and if the two did not
   * agree on their structure the thinking line would sit at one height and
   * the first words of the answer at another. The empty footer is what
   * reserves the space the copy button and timestamp will take.
   */
  return (
    <Message>
      <MessageContent className="gap-2">
        <Bubble variant="ghost" aria-busy="true">
          <BubbleContent>
            <Marker>
              <MarkerIcon>
                <Spinner aria-hidden="true" role="presentation" />
              </MarkerIcon>
              <MarkerContent>
                <span className="animate-pulse motion-reduce:animate-none">
                  {text}
                </span>
              </MarkerContent>
            </Marker>
          </BubbleContent>
        </Bubble>
        <MessageFooter inert aria-hidden="true" className="min-h-7" />
      </MessageContent>
    </Message>
  );
}

type FileTraceProps = {
  trace: TraceModel;
};

/**
 * The files being read before the reply, after ReUI's Trace 22: a
 * collapsible group that stays open while any file is still moving, with a
 * percentage per file. The upload itself is not repeated here; the chips in
 * the composer already showed it.
 */
function FileTrace({ trace }: FileTraceProps) {
  const { files, stage, stopped, queued } = trace;
  const [open, setOpen] = useState<boolean>();

  const total = files.length;
  const noun = total === 1 ? "file" : "files";
  const reading = stage === "reading" && !stopped && !queued;
  const read = files.filter((file) => file.read >= 100).length;

  // A line that was running when Stop was pressed shows as pending: still
  // not done, but no longer shimmering.
  const running = (active: boolean) => {
    if (!active) return undefined;
    // Queued and stopped look the same: listed, but not moving.
    return stopped || queued ? "pending" : "running";
  };

  const header = stopped
    ? `Stopped while reading ${total} ${noun}`
    : queued
      ? `Sending with ${total} ${noun}`
      : stage === "done"
        ? `Answered from ${total} ${noun}`
        : `Reading ${total} ${noun}`;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{header}</p>
      <Trace>
        <TraceCollapsible
          open={open ?? reading}
          onOpenChange={setOpen}
          className={ENTER}
        >
          <TraceCollapsibleTrigger className={TRIGGER_CHEVRON}>
            <TraceLine status={running(stage === "reading")}>
              <TraceIcon>
                <FileSearchIcon />
              </TraceIcon>
              <TraceTitle>
                {queued
                  ? "Read"
                  : reading
                    ? "Reading"
                    : stopped
                      ? "Stopped reading"
                      : "Read"}{" "}
                {total} {noun}
              </TraceTitle>
              <TraceDescription>
                {read} of {total}
              </TraceDescription>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <Trace>
              {files.map((file) => {
                const done = file.read >= 100;
                return (
                  <TraceLine key={file.id} status={running(!done)}>
                    <TraceTitle>
                      {done ? "Read" : stopped ? "Stopped reading" : "Reading"}{" "}
                      {file.name}
                    </TraceTitle>
                    {/* Percentages tick several times a second, so they are
                        hidden from screen readers; the done line is not. */}
                    <TraceDescription aria-hidden={!done}>
                      {done ? formatBytes(file.size) : `${file.read}%`}
                    </TraceDescription>
                  </TraceLine>
                );
              })}
            </Trace>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    </div>
  );
}


type ReplyPreviewProps = {
  message: AssistantMessage;
};

/**
 * One assistant row moving from waiting, to streaming, to settled, after
 * ReUI's Message 7. The bubble stays mounted across states so aria-busy
 * covers the wait and nothing jumps when the first chunk lands.
 */
function ReplyPreview({ message }: ReplyPreviewProps) {
  const waiting = message.status === "waiting";
  const streaming = message.status === "streaming";
  const stoppedEarly =
    message.status === "stopped" && message.text.length === 0;
  const settled =
    message.status === "completed" || message.status === "stopped";

  return (
    <Message className="max-h-72 overflow-y-auto">
      <MessageContent className="gap-2">
        {stoppedEarly ? null : (
          <Bubble variant="ghost" aria-busy={waiting || streaming}>
            <BubbleContent>
              {waiting ? (
                <Marker>
                  <MarkerIcon>
                    <Spinner aria-hidden="true" role="presentation" />
                  </MarkerIcon>
                  <MarkerContent>{message.thinking}</MarkerContent>
                </Marker>
              ) : (
                <p className="whitespace-pre-wrap">
                  {message.text}
                  {streaming ? (
                    <span
                      aria-hidden="true"
                      className="ms-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 bg-foreground"
                    />
                  ) : null}
                </p>
              )}
            </BubbleContent>
          </Bubble>
        )}
        {/*
          The footer holds its place from the first moment the reply block
          exists, through thinking and streaming, and fades in once the reply
          settles. Mounting it at the end instead would push the composer
          down exactly as the reader reaches it, and min-h keeps that space
          reserved while the row is still empty. Hidden from the keyboard and
          screen readers until it is real.
        */}
        <MessageFooter
          inert={!settled}
          aria-hidden={!settled}
          className={cn(
            "min-h-7 gap-2 text-xs transition-opacity duration-200 motion-reduce:transition-none",
            EASE_OUT_STRONG,
            settled ? "opacity-100" : "opacity-0",
          )}
        >
            {message.text.length > 0 ? (
              <CopyButton value={message.text} label="reply" />
            ) : null}
            {/*
              A machine readable timestamp with a short local time inside it,
              so the hour format follows the reader rather than the author.
            */}
            {message.finishedAt ? (
              <time
                dateTime={message.finishedAt.toISOString()}
                // The footer sets a medium weight for its labels; a
                // timestamp is data, not a label, so it stays regular.
                className="font-normal tabular-nums text-muted-foreground"
              >
                {timeFormat.format(message.finishedAt)}
              </time>
            ) : null}
            {message.status === "stopped" ? (
              <span className="text-muted-foreground">
                {stoppedEarly ? "Stopped before the reply" : "Stopped"}
              </span>
            ) : null}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
