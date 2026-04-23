"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

// ── Toolbar button ────────────────────────────────────────────────────────────

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-semibold transition-colors select-none
        ${active
          ? "bg-orange-100 text-orange-600"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"}
        ${disabled ? "opacity-30 pointer-events-none" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-gray-200 mx-0.5 self-center" />;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export type RichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hasError?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RichTextEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Start typing…",
  hasError = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,   // prevents SSR/hydration mismatch in Next.js
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    onBlur() {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        spellcheck: "true",
      },
    },
  });

  // Sync external content changes (e.g. when editing page loads existing data)
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  return (
    <div
      className={`tiptap-editor border rounded-xl overflow-hidden transition-all bg-white
        ${hasError
          ? "border-red-300 ring-2 ring-red-100"
          : "border-gray-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100"}
      `}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-100">

        {/* Text style */}
        <Btn title="Bold (⌘B)" active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </Btn>
        <Btn title="Italic (⌘I)" active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em className="not-italic font-serif text-sm">I</em>
        </Btn>

        <Divider />

        {/* Headings */}
        <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Btn>
        <Btn title="Heading 3" active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Btn>

        <Divider />

        {/* Lists */}
        <Btn title="Bullet list" active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Btn>
        <Btn title="Numbered list" active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </Btn>

        <Divider />

        {/* History */}
        <Btn title="Undo (⌘Z)" disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </Btn>
        <Btn title="Redo (⌘⇧Z)" disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        </Btn>

      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <EditorContent editor={editor} />
    </div>
  );
}
