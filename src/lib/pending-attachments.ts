import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const MAX_ATTACHMENT_FILES = 5;
export const MAX_ATTACHMENT_FILE_SIZE_MB = 10;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

export const AI_ATTACHMENT_BLOCKED_MESSAGE = "Bilder kan skickas via mailformuläret eller när du pratar med support.";
export const HTML_IMAGE_PASTE_MESSAGE = "Bilder från webbsidor eller mail kan inte bifogas direkt. Spara bilden eller använd gemet.";

export interface PendingAttachment {
  tempId: string;
  name: string;
  url: string;
  filename: string;
  isImage: boolean;
  type: string;
  size: number;
  uploading: boolean;
  error?: string;
  previewUrl?: string;
}

interface UsePendingAttachmentsOptions {
  endpoint: "/api/customer/upload" | "/api/upload";
  getSessionId?: () => string;
  maxFiles?: number;
  maxFileSizeMb?: number;
  allowedMimeTypes?: string[];
}

function createTempId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getFileSignature(file: File): string {
  return `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
}

export function getClipboardFiles(data: DataTransfer | null): File[] {
  if (!data) return [];

  const files = Array.from(data.files || []);
  const itemFiles = Array.from(data.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  const seen = new Set<string>();
  return [...files, ...itemFiles].filter((file) => {
    const signature = getFileSignature(file);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function clipboardHasFilesOrImages(data: DataTransfer | null): boolean {
  if (!data) return false;

  if (getClipboardFiles(data).length > 0) return true;

  const items = Array.from(data.items || []);
  if (items.some((item) => item.kind === "file" || item.type.startsWith("image/"))) {
    return true;
  }

  const types = Array.from(data.types || []);
  if (types.includes("Files")) return true;

  const html = data.getData("text/html");
  return /<img\b/i.test(html);
}

export function clipboardHasHtmlImages(data: DataTransfer | null): boolean {
  if (!data) return false;
  return /<img\b/i.test(data.getData("text/html"));
}

export function clipboardHasText(data: DataTransfer | null): boolean {
  if (!data) return false;
  const plainText = data.getData("text/plain");
  if (plainText) return true;
  return Array.from(data.types || []).some((type) => type === "text/plain" || type === "text/html");
}

function normalizePastedText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractTextWithoutImages(root: ParentNode): string {
  const blockTags = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION",
    "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6",
    "HEADER", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE",
    "TD", "TH", "TR", "UL",
  ]);

  const parts: string[] = [];
  const appendBreak = () => {
    if (parts.length && parts[parts.length - 1] !== "\n") parts.push("\n");
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = (node.textContent || "").replace(/\s+/g, " ");
      if (value.trim()) parts.push(value);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    if (element.tagName === "BR") {
      appendBreak();
      return;
    }

    const isBlock = blockTags.has(element.tagName);
    if (isBlock) appendBreak();
    element.childNodes.forEach(walk);
    if (isBlock) appendBreak();
  };

  root.childNodes.forEach(walk);
  return normalizePastedText(parts.join(""));
}

export function sanitizeHtmlPasteForAiMode(data: DataTransfer | null): { text: string; removedImages: boolean } {
  if (!data) return { text: "", removedImages: false };

  const html = data.getData("text/html");
  const removedImages = /<img\b/i.test(html);
  if (!removedImages) {
    return { text: normalizePastedText(data.getData("text/plain") || ""), removedImages: false };
  }

  if (typeof DOMParser === "undefined") {
    return { text: "", removedImages: true };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img, picture, source").forEach((node) => node.remove());
  return {
    text: extractTextWithoutImages(doc.body),
    removedImages: true,
  };
}

export function appendAttachmentMarkdown(message: string, attachments: PendingAttachment[]): string {
  const lines = attachments
    .filter((attachment) => !attachment.uploading && !attachment.error && attachment.url)
    .map((attachment) => {
      if (attachment.isImage) {
        return `![${attachment.name}](${attachment.url})`;
      }
      return `[Fil: ${attachment.name}](${attachment.url})`;
    });

  return [message.trim(), ...lines].filter(Boolean).join("\n\n");
}

export function usePendingAttachments({
  endpoint,
  getSessionId,
  maxFiles = MAX_ATTACHMENT_FILES,
  maxFileSizeMb = MAX_ATTACHMENT_FILE_SIZE_MB,
  allowedMimeTypes = ALLOWED_ATTACHMENT_MIME_TYPES,
}: UsePendingAttachmentsOptions) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const attachmentsRef = useRef<PendingAttachment[]>([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
    };
  }, []);

  const removeAttachment = useCallback((tempId: string) => {
    setAttachments((prev) => {
      const target = prev.find((attachment) => attachment.tempId === tempId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((attachment) => attachment.tempId !== tempId);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
      return [];
    });
  }, []);

  const addFiles = useCallback(async (incomingFiles: File[] | FileList) => {
    const files = Array.from(incomingFiles || []);
    if (!files.length) return;

    const currentCount = attachmentsRef.current.filter((attachment) => !attachment.error).length;
    const remaining = maxFiles - currentCount;
    if (remaining <= 0) {
      toast.error(`Max ${maxFiles} filer tillåtna`);
      return;
    }

    const accepted: File[] = [];
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.type)) {
        toast.error(`Filtypen stöds inte: ${file.name}`);
        continue;
      }
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        toast.error(`${file.name} är för stor (max ${maxFileSizeMb} MB)`);
        continue;
      }
      accepted.push(file);
    }

    const toUpload = accepted.slice(0, remaining);
    if (accepted.length > remaining || files.length > remaining) {
      toast.warning(`Bara ${remaining} fler fil(er) kan läggas till (max ${maxFiles})`);
    }
    if (!toUpload.length) return;

    const pendingAttachments = toUpload.map((file) => ({
      tempId: createTempId(),
      name: file.name,
      url: "",
      filename: "",
      isImage: file.type.startsWith("image/"),
      type: file.type,
      size: file.size,
      uploading: true,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      file,
    }));

    setAttachments((prev) => [
      ...prev,
      ...pendingAttachments.map(({ file: _file, ...attachment }) => attachment),
    ]);

    await Promise.all(pendingAttachments.map(async ({ file, ...pending }) => {
      try {
        const formPayload = new FormData();
        formPayload.append("file", file);
        if (getSessionId) {
          formPayload.append("session_id", getSessionId() || "");
        }

        const response = await fetch(endpoint, {
          method: "POST",
          body: formPayload,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Upload misslyckades");
        }

        const data = await response.json();
        if (!data?.url) {
          throw new Error("Upload saknade fil-URL");
        }

        setAttachments((prev) => prev.map((attachment) =>
          attachment.tempId === pending.tempId
            ? {
              ...attachment,
              url: data.url,
              filename: data.filename || data.originalName || file.name,
              uploading: false,
            }
            : attachment
        ));
      } catch (err: any) {
        setAttachments((prev) => prev.map((attachment) =>
          attachment.tempId === pending.tempId
            ? {
              ...attachment,
              uploading: false,
              error: err.message || "Fel vid uppladdning",
            }
            : attachment
        ));
        toast.error(`Kunde inte ladda upp ${file.name}`);
      }
    }));
  }, [allowedMimeTypes, endpoint, getSessionId, maxFileSizeMb, maxFiles]);

  const isUploading = attachments.some((attachment) => attachment.uploading);
  const validAttachments = attachments.filter((attachment) => !attachment.uploading && !attachment.error && attachment.url);
  const activeAttachmentCount = attachments.filter((attachment) => !attachment.error).length;

  return {
    attachments,
    activeAttachmentCount,
    isUploading,
    validAttachments,
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}
