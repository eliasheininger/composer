"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type RefObject,
} from "react";

import { formatBytes, isAcceptedFile, shortenFileName } from "@/lib/files";
import { ATTACHMENT_LIMITS } from "@/lib/mock-data";
import { simulateUpload, UploadError } from "@/lib/mock-api";

import type { ComposerAttachment } from "./types";

export type UseAttachmentsOptions = {
  maxFiles?: number;
  maxBytes?: number;
  accept?: readonly string[];
  disabled?: boolean;
  /** Called once per batch that produced at least one accepted file. */
  onFilesAdded?: () => void;
};

type DropZoneProps = {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

type RejectionReason = "duplicate" | "type" | "size" | "limit";

/**
 * One short sentence per reason. A single file is named, several are
 * counted: naming them all would wrap, and the names are already visible
 * to the user in whatever they just dropped.
 */
function describeRejection(
  reason: RejectionReason,
  named: string[],
  limits: { maxFiles: number; maxBytes: number },
): string {
  const many = named.length > 1;
  const subject = many
    ? `${named.length} files`
    : shortenFileName(named[0] ?? "");
  const is = many ? "are" : "is";

  switch (reason) {
    case "duplicate":
      return `${subject} ${is} already attached.`;
    case "type":
      return many
        ? `${subject} are not supported file types.`
        : `${subject} is not a supported file type.`;
    case "size":
      return `${subject} ${is} larger than ${formatBytes(limits.maxBytes)}.`;
    case "limit":
      return `You can attach up to ${limits.maxFiles} files.`;
  }
}

function hasFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * Owns the attachment queue for the composer: adding files from the picker,
 * a drop or a paste, validating them against the limits, running the
 * (simulated) upload for each one, and cleaning up object URLs and in-flight
 * uploads when files are removed or the composer unmounts.
 */
export function useAttachments({
  maxFiles = ATTACHMENT_LIMITS.maxFiles,
  maxBytes = ATTACHMENT_LIMITS.maxBytes,
  accept = ATTACHMENT_LIMITS.accept,
  disabled = false,
  onFilesAdded,
}: UseAttachmentsOptions = {}) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  // Mirrors state for callbacks that need the current list without re-creating
  // themselves on every change (addFiles, unmount cleanup).
  const latest = useRef<ComposerAttachment[]>([]);
  // dragenter/dragleave fire for every child the pointer crosses; counting
  // nesting depth keeps the overlay from flickering.
  const dragDepth = useRef(0);

  useEffect(() => {
    latest.current = attachments;
  }, [attachments]);

  const patch = useCallback(
    (id: string, changes: Partial<ComposerAttachment>) => {
      setAttachments((current) =>
        current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      );
    },
    [],
  );

  const startUpload = useCallback(
    (id: string, file: File) => {
      controllers.current.get(id)?.abort();
      const controller = new AbortController();
      controllers.current.set(id, controller);
      patch(id, { status: "uploading", progress: 0, error: undefined });

      simulateUpload(file, {
        signal: controller.signal,
        onProgress: (progress) => patch(id, { progress }),
      })
        .then(() => patch(id, { status: "done", progress: 1 }))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          patch(id, {
            status: "error",
            error:
              error instanceof UploadError ? error.message : "Upload failed",
          });
        })
        .finally(() => {
          if (controllers.current.get(id) === controller) {
            controllers.current.delete(id);
          }
        });
    },
    [patch],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[], source: "picker" | "drop" | "paste") => {
      if (disabled) return;
      const files = Array.from(incoming);
      if (files.length === 0) return;

      const current = latest.current;
      /*
       * Grouped by reason, not by message: two files can shorten to the
       * same string, and a per-file message would then be swallowed. It
       * also keeps a batch of rejects to one short line each.
       */
      const problems = new Map<RejectionReason, string[]>();
      const reject = (reason: RejectionReason, name?: string) => {
        const named = problems.get(reason) ?? [];
        if (name) named.push(name);
        problems.set(reason, named);
      };
      const accepted: ComposerAttachment[] = [];
      let room = maxFiles - current.length;

      for (const raw of files) {
        // Pasted screenshots all arrive as "image.png"; give them a name that
        // still reads well once several are attached.
        const file =
          source === "paste" && raw.name === "image.png"
            ? new File([raw], `pasted-image-${Date.now()}.png`, { type: raw.type })
            : raw;

        const duplicate = [...current, ...accepted].some(
          (item) => item.name === file.name && item.size === file.size,
        );
        if (duplicate) {
          reject("duplicate", file.name);
          continue;
        }
        if (!isAcceptedFile(file, accept)) {
          reject("type", file.name);
          continue;
        }
        if (file.size > maxBytes) {
          reject("size", file.name);
          continue;
        }
        if (room <= 0) {
          reject("limit");
          break;
        }
        room -= 1;

        accepted.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
          status: "uploading",
          progress: 0,
        });
      }

      setRejections(
        [...problems].map(([reason, named]) =>
          describeRejection(reason, named, { maxFiles, maxBytes }),
        ),
      );
      if (accepted.length > 0) {
        setAttachments((existing) => [...existing, ...accepted]);
        for (const item of accepted) startUpload(item.id, item.file);
        onFilesAdded?.();
      }
    },
    [accept, disabled, maxBytes, maxFiles, onFilesAdded, startUpload],
  );

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    setAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const retry = useCallback(
    (id: string) => {
      const target = latest.current.find((item) => item.id === id);
      if (target) startUpload(id, target.file);
    },
    [startUpload],
  );

  /**
   * Empties the queue and hands the finished attachments to the caller, who
   * now owns their preview URLs. Nothing is revoked here on purpose: the
   * transcript needs the thumbnails after the composer has let go of them.
   */
  const detach = useCallback(() => {
    const taken = latest.current;
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    latest.current = [];
    setAttachments([]);
    setRejections([]);
    return taken;
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  // On unmount, cancel anything still uploading and release preview memory.
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active.values()) controller.abort();
      active.clear();
      for (const item of latest.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const openFileDialog = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const getInputProps = useCallback(
    (): InputHTMLAttributes<HTMLInputElement> & {
      ref: RefObject<HTMLInputElement | null>;
    } => ({
      ref: inputRef,
      type: "file",
      multiple: true,
      accept: accept.join(","),
      disabled,
      // Off the tab order: the visible paperclip is the keyboard affordance,
      // but the input stays in the tree so the dialog can be opened from it.
      tabIndex: -1,
      className: "sr-only",
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) addFiles(event.target.files, "picker");
        // Reset so choosing the same file again fires another change event.
        event.target.value = "";
      },
    }),
    [accept, addFiles, disabled],
  );

  const dropZoneProps: DropZoneProps = {
    onDragEnter: (event) => {
      if (!hasFiles(event) || disabled) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    },
    onDragOver: (event) => {
      if (!hasFiles(event) || disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event) => {
      if (!hasFiles(event) || disabled) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    onDrop: (event) => {
      if (!hasFiles(event) || disabled) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      addFiles(event.dataTransfer.files, "drop");
    },
  };

  /** Attach to the textarea. Text pastes are left alone; only files are taken. */
  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      const files = event.clipboardData.files;
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files, "paste");
    },
    [addFiles],
  );

  const isUploading = attachments.some((item) => item.status === "uploading");
  const hasErrors = attachments.some((item) => item.status === "error");

  return {
    attachments,
    rejections,
    isDragging,
    isUploading,
    hasErrors,
    isFull: attachments.length >= maxFiles,
    maxFiles,
    maxBytes,
    addFiles,
    remove,
    retry,
    detach,
    dismissRejections,
    openFileDialog,
    getInputProps,
    dropZoneProps,
    onPaste,
  };
}
