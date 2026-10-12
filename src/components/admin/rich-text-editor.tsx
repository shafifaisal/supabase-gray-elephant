"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { uploadArticleBodyImageAction } from "@/app/admin/articles/image-actions";

/**
 * Visual (WYSIWYG) editor for the article body.
 *
 * The editor is a thin, well-understood surface over Tiptap. All security
 * happens on the server: the submitted HTML is sanitised by the same allowlist
 * that protects the Markdown pipeline (see `lib/content/markdown.ts`) before it
 * is stored, and sanitised again on read. The editor never claims to be a trust
 * boundary.
 *
 * The editable canvas uses the same `.prose-guides` typography as the public
 * article, so what the author sees is what readers get.
 */

/** Font sizes offered in the toolbar, per the product spec. */
const FONT_SIZES = ["12px", "14px", "16px", "18px", "24px", "32px", "48px"];

/** Image widths offered in the image dialog. */
const IMAGE_WIDTHS = ["25%", "50%", "75%", "100%"];

/**
 * `Image` extended with `width` and `align` attributes so authors can size and
 * position inline images. Rendered as an inline `style`; the server sanitiser
 * keeps only the exact CSS properties used here.
 */
const ImageWithSize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-width") || element.style.width || null,
      },
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-align") || null,
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const { width, align, ...rest } = HTMLAttributes as Record<string, unknown>;
    const styles: string[] = [];

    if (width) styles.push(`width: ${String(width)}`);
    if (align === "left") {
      styles.push("display: block", "margin-left: 0", "margin-right: auto");
    } else if (align === "center") {
      styles.push("display: block", "margin-left: auto", "margin-right: auto");
    } else if (align === "right") {
      styles.push("display: block", "margin-left: auto", "margin-right: 0");
    }

    const attributes: Record<string, unknown> = { ...rest };
    if (width) attributes["data-width"] = width;
    if (align) attributes["data-align"] = align;
    if (styles.length > 0) attributes.style = styles.join("; ");

    return ["img", attributes];
  },
});

export interface RichTextEditorProps {
  /** Form field name the serialised HTML is submitted under. */
  name: string;
  /** Initial content (HTML). */
  defaultValue?: string;
  /** id of a hint element describing the field. */
  describedBy?: string;
  /** Notified with the current HTML whenever the document changes. */
  onHtmlChange?: (html: string) => void;
}

export function RichTextEditor({
  name,
  defaultValue = "",
  describedBy,
  onHtmlChange,
}: RichTextEditorProps) {
  const [html, setHtml] = useState(defaultValue);
  // Re-render the toolbar on every transaction so active states stay accurate.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: {
          openOnClick: false,
          autolink: true,
          // Per-link `target`/`rel` are set by the link dialog; the server
          // sanitizer also forces a safe `rel` on every stored link.
          HTMLAttributes: {},
        },
      }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageWithSize.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "Write your article…",
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: defaultValue,
    // Required for SSR: the editor is created in an effect on the client.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-guides min-h-[22rem] px-4 py-4 focus:outline-none sm:min-h-[28rem]",
        "aria-label": "Article body",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const next = editor.isEmpty ? "" : editor.getHTML();
      setHtml(next);
      onHtmlChange?.(next);
    };
    const handleTransaction = () => bump();

    editor.on("update", handleUpdate);
    editor.on("transaction", handleTransaction);
    handleUpdate();

    return () => {
      editor.off("update", handleUpdate);
      editor.off("transaction", handleTransaction);
    };
  }, [editor, onHtmlChange]);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      {editor ? <EditorToolbar editor={editor} /> : (
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          Loading editor…
        </div>
      )}
      <EditorContent editor={editor} aria-describedby={describedBy} />
      {/* The serialised content the form actually submits. */}
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                     */
/* -------------------------------------------------------------------------- */

function EditorToolbar({ editor }: { editor: Editor }) {
  const [dialog, setDialog] = useState<null | "link" | "image" | "table">(null);

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-secondary/60 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1 p-2">
        <Group>
          <ToolButton
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Icon path="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 0 14h-3" />
          </ToolButton>
          <ToolButton
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Icon path="m15 14 5-5-5-5M20 9h-9a7 7 0 0 0 0 14h3" />
          </ToolButton>
        </Group>

        <Group>
          <select
            aria-label="Block style"
            value={
              [1, 2, 3, 4, 5, 6].find((level) =>
                editor.isActive("heading", { level }),
              )
                ? `h${[1, 2, 3, 4, 5, 6].find((level) =>
                    editor.isActive("heading", { level }),
                  )}`
                : "paragraph"
            }
            onChange={(event) => {
              const value = event.target.value;
              if (value === "paragraph") {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().setHeading({ level }).run();
              }
            }}
            className={selectClasses}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
          </select>

          <select
            aria-label="Font size"
            value={(editor.getAttributes("textStyle").fontSize as string) ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const chain = editor.chain().focus();
              if (!value) chain.unsetFontSize().run();
              else chain.setFontSize(value).run();
            }}
            className={selectClasses}
          >
            <option value="">Size</option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Group>

        <Group>
          <ToolButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <span className="font-bold">B</span>
          </ToolButton>
          <ToolButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <span className="font-serif italic">I</span>
          </ToolButton>
          <ToolButton
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </ToolButton>
          <ToolButton
            label="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <span className="line-through">S</span>
          </ToolButton>
          <ToolButton
            label="Inline code"
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <span className="font-mono text-xs">{"</>"}</span>
          </ToolButton>
        </Group>

        <Group>
          <ColorControl
            label="Text colour"
            value={(editor.getAttributes("textStyle").color as string) || "#000000"}
            onChange={(color) => editor.chain().focus().setColor(color).run()}
            onClear={() => editor.chain().focus().unsetColor().run()}
          />
          <ColorControl
            label="Highlight colour"
            value={(editor.getAttributes("highlight").color as string) || "#ffff00"}
            onChange={(color) =>
              editor.chain().focus().toggleHighlight({ color }).run()
            }
            onClear={() => editor.chain().focus().unsetHighlight().run()}
          />
          <ToolButton
            label="Clear formatting"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <Icon path="M4 20h16M14 4 6 12l4 4 8-8-4-4ZM8 16l-4 4" />
          </ToolButton>
        </Group>

        <Group>
          <ToolButton
            label="Align left"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <Icon path="M4 6h16M4 12h10M4 18h14" />
          </ToolButton>
          <ToolButton
            label="Align centre"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <Icon path="M4 6h16M7 12h10M5 18h14" />
          </ToolButton>
          <ToolButton
            label="Align right"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <Icon path="M4 6h16M10 12h10M6 18h14" />
          </ToolButton>
          <ToolButton
            label="Justify"
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <Icon path="M4 6h16M4 12h16M4 18h16" />
          </ToolButton>
        </Group>

        <Group>
          <ToolButton
            label="Bulleted list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <Icon path="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <Icon path="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4l2-2v-2H4" />
          </ToolButton>
          <ToolButton
            label="Increase indent"
            onClick={() =>
              editor.chain().focus().sinkListItem("listItem").run()
            }
            disabled={!editor.can().sinkListItem("listItem")}
          >
            <Icon path="M11 7h10M11 12h10M11 17h10M4 9l3 3-3 3" />
          </ToolButton>
          <ToolButton
            label="Decrease indent"
            onClick={() =>
              editor.chain().focus().liftListItem("listItem").run()
            }
            disabled={!editor.can().liftListItem("listItem")}
          >
            <Icon path="M11 7h10M11 12h10M11 17h10M7 9l-3 3 3 3" />
          </ToolButton>
          <ToolButton
            label="Quote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Icon path="M7 7H4v6h6V7M20 7h-3v6h6V7" />
          </ToolButton>
          <ToolButton
            label="Horizontal divider"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Icon path="M4 12h16" />
          </ToolButton>
        </Group>

        <Group>
          <ToolButton
            label="Insert link"
            active={editor.isActive("link")}
            onClick={() => setDialog((d) => (d === "link" ? null : "link"))}
          >
            <Icon path="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
          </ToolButton>
          <ToolButton
            label="Insert image"
            onClick={() => setDialog((d) => (d === "image" ? null : "image"))}
          >
            <Icon path="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9h.01" />
          </ToolButton>
          <ToolButton
            label="Insert table"
            onClick={() => setDialog((d) => (d === "table" ? null : "table"))}
          >
            <Icon path="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14M15 5v14" />
          </ToolButton>
        </Group>
      </div>

      {editor.isActive("table") ? <TableControls editor={editor} /> : null}

      {dialog === "link" ? (
        <LinkDialog editor={editor} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "image" ? (
        <ImageDialog editor={editor} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "table" ? (
        <TableDialog editor={editor} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar pieces                                                              */
/* -------------------------------------------------------------------------- */

const selectClasses =
  "h-8 rounded border border-border bg-background px-1.5 text-sm text-foreground";

const buttonClasses =
  "inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-40";
const buttonActiveClasses = "bg-background text-foreground shadow-sm";

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 border-r border-border/70 px-1 last:border-r-0">
      {children}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`${buttonClasses} ${active ? buttonActiveClasses : ""}`}
    >
      {children}
    </button>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function ColorControl({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center">
      <label
        title={label}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded hover:bg-background"
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className="text-sm font-semibold"
          style={{ borderBottom: `3px solid ${value}` }}
        >
          {label.startsWith("Text") ? "A" : "H"}
        </span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
      <button
        type="button"
        onClick={onClear}
        title={`Clear ${label.toLowerCase()}`}
        aria-label={`Clear ${label.toLowerCase()}`}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialogs                                                                     */
/* -------------------------------------------------------------------------- */

const panelClasses =
  "flex flex-wrap items-end gap-2 border-t border-border bg-background p-3";

function LinkDialog({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const existing = editor.getAttributes("link") as {
    href?: string;
    target?: string;
  };
  const [url, setUrl] = useState(existing.href ?? "");
  const [text, setText] = useState("");
  const [newTab, setNewTab] = useState(existing.target === "_blank");

  function apply() {
    const raw = url.trim();
    if (!raw) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    const href = /^(https?:|mailto:|tel:|\/|#)/i.test(raw) ? raw : `https://${raw}`;
    const attrs = {
      href,
      target: newTab ? "_blank" : null,
      rel: newTab ? "noopener noreferrer" : null,
    };
    const display = text.trim();
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (display || !hasSelection) {
      // A display text was supplied (or there is nothing selected): insert the
      // linked text at the cursor, replacing any current selection.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: display || href,
          marks: [{ type: "link", attrs }],
        })
        .run();
    } else {
      // No display text but text is selected: turn the selection into a link.
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    }
    onClose();
  }

  return (
    <div className={panelClasses}>
      <Field label="URL">
        <input
          autoFocus
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          className={`${selectClasses} w-64`}
        />
      </Field>
      <Field label="Display text (optional)">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Read more"
          className={`${selectClasses} w-48`}
        />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          checked={newTab}
          onChange={(event) => setNewTab(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Open in new tab
      </label>
      <div className="flex gap-2 pb-0.5">
        <button type="button" onClick={apply} className={primaryButton}>
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            onClose();
          }}
          className={secondaryButton}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function ImageDialog({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [width, setWidth] = useState("");
  const [align, setAlign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("image", file);
      formData.set("altText", alt);
      const result = await uploadArticleBodyImageAction(null, formData);
      if (result.ok && result.image) {
        setUrl(result.image.url);
        if (!alt && result.image.altText) setAlt(result.image.altText);
      } else {
        setError(result.error ?? "Upload failed.");
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function insert() {
    const src = url.trim();
    if (!src) {
      setError("Choose an image or enter a URL.");
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src,
          alt: alt.trim() || null,
          width: width || null,
          align: align || null,
        },
      })
      .run();
    onClose();
  }

  return (
    <div className={panelClasses}>
      <Field label="Upload image">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(file);
          }}
          className="text-sm"
        />
      </Field>
      <Field label="…or image URL">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…/image.png"
          className={`${selectClasses} w-64`}
        />
      </Field>
      <Field label="Alt text">
        <input
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Describe the image"
          className={`${selectClasses} w-56`}
        />
      </Field>
      <Field label="Width">
        <select
          value={width}
          onChange={(event) => setWidth(event.target.value)}
          className={selectClasses}
        >
          <option value="">Auto</option>
          {IMAGE_WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Align">
        <select
          value={align}
          onChange={(event) => setAlign(event.target.value)}
          className={selectClasses}
        >
          <option value="">Default</option>
          <option value="left">Left</option>
          <option value="center">Centre</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <div className="flex gap-2 pb-0.5">
        <button
          type="button"
          onClick={insert}
          disabled={uploading}
          className={primaryButton}
        >
          Insert
        </button>
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
      </div>
      {uploading ? (
        <p className="w-full text-sm text-muted-foreground">Uploading…</p>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TableDialog({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [header, setHeader] = useState(true);

  return (
    <div className={panelClasses}>
      <Field label="Rows">
        <input
          type="number"
          min={1}
          max={20}
          value={rows}
          onChange={(event) => setRows(Number(event.target.value))}
          className={`${selectClasses} w-20`}
        />
      </Field>
      <Field label="Columns">
        <input
          type="number"
          min={1}
          max={10}
          value={cols}
          onChange={(event) => setCols(Number(event.target.value))}
          className={`${selectClasses} w-20`}
        />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          checked={header}
          onChange={(event) => setHeader(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Header row
      </label>
      <div className="flex gap-2 pb-0.5">
        <button
          type="button"
          onClick={() => {
            editor
              .chain()
              .focus()
              .insertTable({
                rows: Math.max(1, Math.min(20, rows)),
                cols: Math.max(1, Math.min(10, cols)),
                withHeaderRow: header,
              })
              .run();
            onClose();
          }}
          className={primaryButton}
        >
          Insert table
        </button>
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TableControls({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border bg-background px-2 py-1.5 text-xs">
      <span className="mr-1 font-medium text-muted-foreground">Table:</span>
      <TableAction
        label="Add column"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />
      <TableAction
        label="Delete column"
        onClick={() => editor.chain().focus().deleteColumn().run()}
      />
      <TableAction
        label="Add row"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />
      <TableAction
        label="Delete row"
        onClick={() => editor.chain().focus().deleteRow().run()}
      />
      <TableAction
        label="Toggle header row"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      />
      <TableAction
        label="Delete table"
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </div>
  );
}

function TableAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border px-2 py-0.5 transition-colors hover:bg-secondary"
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

const primaryButton =
  "h-8 rounded bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const secondaryButton =
  "h-8 rounded border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary";
