export type AttachmentStatus = "uploading" | "error" | "done";

export type ComposerAttachment = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  /** Object URL for image thumbnails. Whoever holds the attachment revokes it. */
  previewUrl?: string;
  status: AttachmentStatus;
  /** 0 to 1 while uploading, 1 once done. */
  progress: number;
  /** Human readable reason when status is "error". */
  error?: string;
};

/**
 * What the composer hands back when the user sends a message. Attachments are
 * only ever included once every upload has finished.
 */
export type ComposerSubmission = {
  text: string;
  attachments: ComposerAttachment[];
  modelId: string;
};

/** What the surrounding conversation is doing; drives the send/stop control. */
export type ComposerActivity = "idle" | "sending" | "generating";
