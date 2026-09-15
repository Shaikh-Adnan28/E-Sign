import { describe, it, expect } from "vitest";

describe("Phase 5 — Template Schema & Duplication Mechanics", () => {
  interface TemplateRoleMock {
    id: string;
    roleName: string;
    order: number;
  }

  interface TemplateFieldMock {
    id: string;
    roleId: string | null;
    type: "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX";
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
  }

  interface TemplateMock {
    id: string;
    name: string;
    storageKey: string;
    roles: TemplateRoleMock[];
    fields: TemplateFieldMock[];
    usageCount: number;
  }

  function duplicateTemplate(source: TemplateMock, newId: string): TemplateMock {
    const roleMap = new Map<string, string>();
    const newRoles: TemplateRoleMock[] = source.roles.map((r, i) => {
      const newRoleId = `role-copy-${i + 1}`;
      roleMap.set(r.id, newRoleId);
      return {
        id: newRoleId,
        roleName: r.roleName,
        order: r.order,
      };
    });

    const newFields: TemplateFieldMock[] = source.fields.map((f, i) => ({
      id: `field-copy-${i + 1}`,
      roleId: f.roleId ? roleMap.get(f.roleId) ?? null : null,
      type: f.type,
      pageNumber: f.pageNumber,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
    }));

    return {
      id: newId,
      name: `${source.name} (Copy)`,
      storageKey: `templates/${newId}/original.pdf`,
      roles: newRoles,
      fields: newFields,
      usageCount: 0,
    };
  }

  it("duplicates template with new IDs and maps role references accurately", () => {
    const original: TemplateMock = {
      id: "tmpl-orig",
      name: "Employment Agreement",
      storageKey: "templates/tmpl-orig/original.pdf",
      usageCount: 15,
      roles: [
        { id: "role-emp", roleName: "Employee", order: 1 },
        { id: "role-[#1A56DB]", roleName: "Manager", order: 2 },
      ],
      fields: [
        { id: "f-1", roleId: "role-emp", type: "SIGNATURE", pageNumber: 1, x: 0.1, y: 0.7, width: 0.3, height: 0.08, required: true },
        { id: "f-2", roleId: "role-[#1A56DB]", type: "SIGNATURE", pageNumber: 1, x: 0.5, y: 0.7, width: 0.3, height: 0.08, required: true },
      ],
    };

    const copy = duplicateTemplate(original, "tmpl-copy-1");

    expect(copy.id).toBe("tmpl-copy-1");
    expect(copy.name).toBe("Employment Agreement (Copy)");
    expect(copy.usageCount).toBe(0);
    expect(copy.roles).toHaveLength(2);
    expect(copy.roles[0].id).not.toBe("role-emp");

    // Check role mapping on fields
    expect(copy.fields[0].roleId).toBe(copy.roles[0].id);
    expect(copy.fields[1].roleId).toBe(copy.roles[1].id);

    // Verify original remains untouched
    expect(original.usageCount).toBe(15);
    expect(original.roles[0].id).toBe("role-emp");
  });
});

describe("Phase 5 — Envelope Instantiation from Template", () => {
  interface RecipientInput {
    roleId: string;
    email: string;
    name?: string;
  }

  it("creates independent signers and signature fields mapped from template roles", () => {
    const templateRoles = [
      { id: "role-1", roleName: "Client", order: 1 },
      { id: "role-2", roleName: "Provider", order: 2 },
    ];

    const templateFields = [
      { id: "tf-1", roleId: "role-1", type: "SIGNATURE", pageNumber: 1, x: 0.1, y: 0.8, width: 0.3, height: 0.08, required: true },
      { id: "tf-2", roleId: "role-2", type: "SIGNATURE", pageNumber: 1, x: 0.5, y: 0.8, width: 0.3, height: 0.08, required: true },
    ];

    const recipients: RecipientInput[] = [
      { roleId: "role-1", email: "alice@example.com", name: "Alice Smith" },
      { roleId: "role-2", email: "bob@example.com", name: "Bob Jones" },
    ];

    // Instantiation logic
    const roleToSignerMap = new Map<string, string>();
    const instantiatedSigners = recipients.map((r, i) => {
      const signerId = `signer-${i + 1}`;
      roleToSignerMap.set(r.roleId, signerId);
      return {
        id: signerId,
        email: r.email,
        name: r.name,
      };
    });

    const instantiatedFields = templateFields.map((tf, i) => ({
      id: `field-inst-${i + 1}`,
      signerId: tf.roleId ? roleToSignerMap.get(tf.roleId) : null,
      type: tf.type,
      x: tf.x,
      y: tf.y,
    }));

    expect(templateRoles).toHaveLength(2);
    expect(instantiatedSigners).toHaveLength(2);
    expect(instantiatedSigners[0].email).toBe("alice@example.com");

    expect(instantiatedFields[0].signerId).toBe("signer-1");
    expect(instantiatedFields[1].signerId).toBe("signer-2");
  });
});
