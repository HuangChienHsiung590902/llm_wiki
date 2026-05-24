import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWikiStore } from "@/stores/wiki-store"
import { writeFileAtomic, listDirectory } from "@/commands/fs"

const PAGE_TYPES = ["entity", "concept", "overview", "comparison", "synthesis", "query", "other"] as const
type PageType = (typeof PAGE_TYPES)[number]

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w一-鿿-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildMarkdown(title: string, type: PageType, tags: string[], description: string, body: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const tagsYaml = tags.length > 0 ? `[${tags.map((t) => t.trim()).filter(Boolean).join(", ")}]` : "[]"
  const descLine = description.trim() ? `description: "${description.trim().replace(/"/g, '\\"')}"\n` : ""
  const frontmatter = `---\ntitle: ${title}\ntype: ${type}\n${descLine}tags: ${tagsYaml}\ncreated: ${today}\nupdated: ${today}\n---\n\n`
  const bodyContent = body.trim() ? body.trim() + "\n" : `# ${title}\n\n`
  return frontmatter + bodyContent
}

interface Props {
  onDone: () => void
}

export function NewPageForm({ onDone }: Props) {
  const { t } = useTranslation()
  const project = useWikiStore((s) => s.project)
  const setFileTree = useWikiStore((s) => s.setFileTree)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)
  const setActiveView = useWikiStore((s) => s.setActiveView)

  const [title, setTitle] = useState("")
  const [type, setType] = useState<PageType>("entity")
  const [tags, setTags] = useState("")
  const [description, setDescription] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(t("newPage.errorTitleRequired"))
      return
    }
    const slug = toSlug(trimmedTitle)
    if (!slug) {
      setError(t("newPage.errorInvalidTitle"))
      return
    }
    const filePath = `${project.path}/wiki/${slug}.md`
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean)
    const content = buildMarkdown(trimmedTitle, type, tagList, description, body)

    setSaving(true)
    setError("")
    try {
      await writeFileAtomic(filePath, content)
      const tree = await listDirectory(project.path)
      setFileTree(tree)
      setSelectedFile(filePath)
      setActiveView("wiki")
      onDone()
    } catch (err) {
      setError(String(err))
      setSaving(false)
    }
  }

  const typeLabels: Record<PageType, string> = {
    entity: t("graph.nodeTypeLabels.entity"),
    concept: t("graph.nodeTypeLabels.concept"),
    overview: t("graph.nodeTypeLabels.overview"),
    comparison: t("graph.nodeTypeLabels.comparison"),
    synthesis: t("graph.nodeTypeLabels.synthesis"),
    query: t("graph.nodeTypeLabels.query"),
    other: t("graph.nodeTypeLabels.other"),
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("newPage.title")}
      </p>

      {/* 標題 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">{t("newPage.pageTitle")} <span className="text-destructive">*</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("newPage.pageTitlePlaceholder")}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
        {title && (
          <p className="text-[11px] text-muted-foreground">slug: {toSlug(title) || "—"}</p>
        )}
      </div>

      {/* 類型 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">{t("newPage.pageType")}</label>
        <div className="flex flex-wrap gap-1">
          {PAGE_TYPES.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setType(pt)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                type === pt
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {typeLabels[pt]}
            </button>
          ))}
        </div>
      </div>

      {/* 標籤 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">{t("newPage.tags")}</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("newPage.tagsPlaceholder")}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 摘要 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">{t("newPage.description")}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("newPage.descriptionPlaceholder")}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 初始內容 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">{t("newPage.body")}</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("newPage.bodyPlaceholder")}
          rows={4}
          className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 按鈕 */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {saving ? t("newPage.creating") : t("newPage.create")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          {t("project.cancel")}
        </button>
      </div>
    </form>
  )
}
