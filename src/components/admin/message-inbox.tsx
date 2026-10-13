"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ContactMessageRow } from "@/lib/content/contact-messages";
import { formatDate, formatDateTime } from "@/lib/format";

import {
  deleteMessageAction,
  setMessageStatusAction,
} from "@/app/admin/messages/actions";

/**
 * Admin inbox for contact messages.
 *
 * Mirrors a mail client: a compact list (sender, subject, delete) and a centred
 * modal with the full message when a row is clicked. The overlay is blurred.
 * Everything is presentational — no message is transmitted or stored anywhere;
 * the rows are read once on the server and passed in as props.
 */
export function MessageInbox({
  messages,
  canManage,
  page,
}: {
  messages: ContactMessageRow[];
  canManage: boolean;
  page: number;
}) {
  const [selected, setSelected] = useState<ContactMessageRow | null>(null);

  const close = useCallback(() => setSelected(null), []);

  if (messages.length === 0) {
    return (
      <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-border bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
        No messages yet.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
        <ul className="divide-y divide-border">
          {messages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              canManage={canManage}
              page={page}
              onOpen={() => setSelected(message)}
            />
          ))}
        </ul>
      </div>

      {selected ? (
        <MessageModal message={selected} canManage={canManage} onClose={close} />
      ) : null}
    </>
  );
}

function MessageRow({
  message,
  canManage,
  page,
  onOpen,
}: {
  message: ContactMessageRow;
  canManage: boolean;
  page: number;
  onOpen: () => void;
}) {
  const unread = message.status === "new";

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus:outline-none"
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${
            unread ? "bg-primary" : "bg-transparent"
          }`}
        />
        <span
          className={`w-40 shrink-0 truncate text-sm ${
            unread ? "font-semibold" : "font-medium"
          }`}
        >
          {message.name}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {message.subject}
        </span>
        <time
          dateTime={message.created_at}
          className="w-24 shrink-0 text-right text-xs text-muted-foreground"
        >
          {formatDate(new Date(message.created_at))}
        </time>
      </button>

      {canManage ? (
        <DeleteMessageButton
          id={message.id}
          senderName={message.name}
          page={page}
        />
      ) : null}
    </li>
  );
}

function DeleteMessageButton({
  id,
  senderName,
  page,
}: {
  id: string;
  senderName: string;
  page: number;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form
        action={deleteMessageAction}
        className="flex shrink-0 items-center gap-1"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="page" value={page} />
        <button
          type="submit"
          className="h-8 rounded-md border border-danger/50 px-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-8 rounded-md border border-border px-2 text-xs font-semibold transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={`Delete message from ${senderName}`}
      title="Delete message"
      className="shrink-0 rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-danger"
    >
      <TrashIcon />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function MessageModal({
  message,
  canManage,
  onClose,
}: {
  message: ContactMessageRow;
  canManage: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred overlay. Clicking it dismisses the modal. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-modal-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2
              id="message-modal-title"
              className="truncate text-lg font-semibold"
            >
              {message.subject}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(new Date(message.created_at))}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close message"
            className="shrink-0 rounded-md border border-border px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="space-y-3 text-sm">
            <Detail label="Name" value={message.name} />
            <Detail
              label="Email"
              value={
                <span className="inline-flex items-center gap-2">
                  <a
                    href={`mailto:${message.email}`}
                    className="text-foreground underline underline-offset-2"
                  >
                    {message.email}
                  </a>
                  <CopyButton value={message.email} label="Copy email address" />
                </span>
              }
            />
            <Detail
              label="Whatsapp No."
              value={
                message.mobile ? (
                  <a
                    href={`tel:${message.mobile}`}
                    className="text-foreground underline underline-offset-2"
                  >
                    {message.mobile}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )
              }
            />
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.message}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-6 py-3">
            <form action={setMessageStatusAction}>
              <input type="hidden" name="id" value={message.id} />
              <input
                type="hidden"
                name="status"
                value={message.status === "read" ? "new" : "read"}
              />
              <button
                type="submit"
                className="h-9 rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                {message.status === "read" ? "Mark as unread" : "Mark as read"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_0.75rem_1fr] gap-x-1">
      <span className="text-muted-foreground">{label}</span>
      <span aria-hidden="true" className="text-muted-foreground">
        :
      </span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

/**
 * Small icon button that copies a value to the clipboard. The value is only
 * ever read here for a local clipboard write; nothing is transmitted.
 */
function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the icon as is.
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-success"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
