import type { ComponentType, SVGProps } from "react";

import {
  FileIconCsv,
  FileIconExcel,
  FileIconGeneric,
  FileIconImage,
  FileIconJson,
  FileIconMarkdown,
  FileIconPdf,
  FileIconPowerpoint,
  FileIconText,
  FileIconWord,
  FileIconZip,
} from "@/components/ui/svgs/file-types";

export type FileKind = {
  /** Short, human label shown under the file name, e.g. "PDF". */
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: { label: "PDF", Icon: FileIconPdf },
  xls: { label: "Excel", Icon: FileIconExcel },
  xlsx: { label: "Excel", Icon: FileIconExcel },
  csv: { label: "CSV", Icon: FileIconCsv },
  doc: { label: "Word", Icon: FileIconWord },
  docx: { label: "Word", Icon: FileIconWord },
  ppt: { label: "PowerPoint", Icon: FileIconPowerpoint },
  pptx: { label: "PowerPoint", Icon: FileIconPowerpoint },
  md: { label: "Markdown", Icon: FileIconMarkdown },
  txt: { label: "Text", Icon: FileIconText },
  json: { label: "JSON", Icon: FileIconJson },
  zip: { label: "Archive", Icon: FileIconZip },
};

/**
 * Classifies a file by MIME type first, then by extension, because browsers
 * report an empty type for some plain-text formats.
 */
export function getFileKind(type: string, name: string): FileKind {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return { label: "Image", Icon: FileIconImage };
  if (type === "application/pdf") return BY_EXTENSION.pdf;
  if (type === "text/csv") return BY_EXTENSION.csv;
  if (type === "text/markdown") return BY_EXTENSION.md;
  return (
    BY_EXTENSION[extension] ??
    (type.startsWith("text/")
      ? BY_EXTENSION.txt
      : { label: "File", Icon: FileIconGeneric })
  );
}

type FileTypeIconProps = {
  type: string;
  name: string;
  className?: string;
};

/** The full-colour file-type icon for a file, e.g. the red Adobe-style PDF. */
export function FileTypeIcon({ type, name, className }: FileTypeIconProps) {
  const { Icon } = getFileKind(type, name);
  return <Icon className={className} aria-hidden="true" />;
}
