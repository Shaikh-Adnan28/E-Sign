import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, templateRoles, templateFields } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { MOCK_TEMPLATES } from "@/lib/mock-dashboard-data";
import TemplateEditorClient from "@/components/templates/TemplateEditorClient";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  let template: typeof templates.$inferSelect | null = null;
  let roles: typeof templateRoles.$inferSelect[] = [];
  let fields: typeof templateFields.$inferSelect[] = [];

  try {
    const [t] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.ownerId, session.user.id)))
      .limit(1);

    if (t) {
      template = t;
      [roles, fields] = await Promise.all([
        db.select().from(templateRoles).where(eq(templateRoles.templateId, id)).orderBy(asc(templateRoles.order)),
        db.select().from(templateFields).where(eq(templateFields.templateId, id)),
      ]);
    }
  } catch {
    // fallback
  }

  // Dev Mock Fallback
  if (!template && (id.startsWith("mock-tmpl-") || process.env.NODE_ENV !== "production")) {
    const mock = MOCK_TEMPLATES.find((m) => m.id === id) || MOCK_TEMPLATES[0];
    return (
      <TemplateEditorClient
        templateId={mock.id}
        templateName={mock.name}
        pageCount={mock.pageCount}
        initialRoles={mock.roles}
        initialFields={mock.fields.map((f) => ({
          id: f.id,
          roleId: f.roleId,
          type: f.type,
          pageNumber: f.pageNumber,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          required: f.required,
        }))}
      />
    );
  }

  if (!template) return notFound();

  const formattedFields = fields.map((f) => ({
    id: f.id,
    roleId: f.roleId,
    type: f.type as "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX",
    pageNumber: f.pageNumber,
    x: Number(f.x),
    y: Number(f.y),
    width: Number(f.width),
    height: Number(f.height),
    required: f.required ?? true,
    placeholder: f.placeholder ?? undefined,
  }));

  return (
    <TemplateEditorClient
      templateId={template.id}
      templateName={template.name}
      pageCount={template.pageCount ?? 1}
      initialRoles={roles.map((r) => ({
        id: r.id,
        roleName: r.roleName,
        order: r.order,
      }))}
      initialFields={formattedFields}
    />
  );
}
