import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bold, Underline, Heading1, Heading2, List, ListOrdered, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFamilyValues, saveFamilyValues } from "@/lib/family-values.functions";
import { toast } from "sonner";

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    blockquote: false,
    strike: false,
    italic: false,
    horizontalRule: false,
    link: false,
  }),
];

export const valuesProseClass =
  "family-values focus:outline-none min-h-[40vh] text-foreground leading-relaxed";

function ToolBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-8 w-8"
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    editor.on("transaction", f);
    return () => { editor.off("transaction", f); };
  }, [editor]);
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap gap-1 border-b border-border/60 p-2 sticky top-[57px] z-10 bg-card/95 backdrop-blur rounded-t-2xl">
      <ToolBtn label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading1 className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Sub-heading" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Underline" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolBtn>
    </div>
  );
}

export function FamilyValuesView({ editable }: { editable: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["family-values"], queryFn: () => getFamilyValues() });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | null>(null);

  const editor = useEditor({
    extensions,
    editable,
    immediatelyRender: false,
    content: "",
    editorProps: { attributes: { class: valuesProseClass } },
    onUpdate: ({ editor }) => {
      if (!editable) return;
      if (timer.current) window.clearTimeout(timer.current);
      setStatus("saving");
      timer.current = window.setTimeout(async () => {
        try {
          await saveFamilyValues({ data: { content: editor.getHTML() } });
          qc.setQueryData(["family-values"], { content: editor.getHTML(), updatedAt: new Date().toISOString() });
          setStatus("saved");
        } catch (e) {
          toast.error((e as Error).message);
          setStatus("idle");
        }
      }, 900);
    },
  });

  const loaded = useRef(false);
  useEffect(() => {
    if (editor && data && !loaded.current) {
      editor.commands.setContent(data.content || "", { emitUpdate: false });
      loaded.current = true;
    }
  }, [editor, data]);

  if (isLoading || !editor) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!editable && !data?.content?.replace(/<[^>]*>/g, "").trim()) {
    return (
      <div className="rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        No family values have been written yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60">
      {editable && <Toolbar editor={editor} />}
      <div className="p-5 relative">
        {editable && editor.isEmpty && (
          <p className="pointer-events-none absolute text-muted-foreground text-sm">Start typing your family values and house rules…</p>
        )}
        <EditorContent editor={editor} />
      </div>
      {editable && (
        <div className="flex justify-end px-4 pb-3 text-xs text-muted-foreground">
          {status === "saving" && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>}
          {status === "saved" && <span className="flex items-center gap-1"><Check className="h-3 w-3" />Saved</span>}
        </div>
      )}
    </div>
  );
}
