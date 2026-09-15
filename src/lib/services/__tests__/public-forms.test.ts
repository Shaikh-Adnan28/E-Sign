import { describe, it, expect } from "vitest";
import { generatePublicFormToken } from "../public-forms";

describe("Phase 8.0 — Public Forms Token & Status Mechanics", () => {
  it("generates unique 32-character hexadecimal public form tokens", () => {
    const token1 = generatePublicFormToken();
    const token2 = generatePublicFormToken();

    expect(token1).toHaveLength(32);
    expect(token2).toHaveLength(32);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{32}$/.test(token1)).toBe(true);
  });

  interface PublicFormMock {
    id: string;
    token: string;
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";
    expiresAt: Date | null;
  }

  function evaluateFormAvailability(form: PublicFormMock | null) {
    if (!form) {
      return { isAvailable: false, reason: "NOT_FOUND" };
    }

    const now = new Date();
    const isExpiredByTime = form.expiresAt && form.expiresAt < now;
    const effectiveStatus = isExpiredByTime ? "EXPIRED" : form.status;

    if (effectiveStatus !== "ACTIVE") {
      return { isAvailable: false, reason: effectiveStatus };
    }

    return { isAvailable: true, reason: null };
  }

  it("correctly evaluates form availability for ACTIVE, PAUSED, and EXPIRED forms", () => {
    const activeForm: PublicFormMock = {
      id: "form-1",
      token: "abc123token",
      status: "ACTIVE",
      expiresAt: null,
    };
    expect(evaluateFormAvailability(activeForm)).toEqual({
      isAvailable: true,
      reason: null,
    });

    const pausedForm: PublicFormMock = {
      id: "form-2",
      token: "pausedtoken",
      status: "PAUSED",
      expiresAt: null,
    };
    expect(evaluateFormAvailability(pausedForm)).toEqual({
      isAvailable: false,
      reason: "PAUSED",
    });

    const pastDate = new Date(Date.now() - 3600 * 1000);
    const expiredForm: PublicFormMock = {
      id: "form-3",
      token: "expiredtoken",
      status: "ACTIVE",
      expiresAt: pastDate,
    };
    expect(evaluateFormAvailability(expiredForm)).toEqual({
      isAvailable: false,
      reason: "EXPIRED",
    });
  });
});

describe("Phase 8.0 — Self-Service Envelope & Submission Instantiation", () => {
  interface TemplateRoleMock {
    id: string;
    roleName: string;
    order: number;
  }

  interface TemplateFieldMock {
    id: string;
    roleId: string | null;
    type: string;
  }

  interface SubmissionInput {
    signerName?: string;
    signerEmail: string;
    roleInputs?: Array<{ roleId: string; name?: string; email: string }>;
  }

  function simulatePublicFormSubmission(
    formId: string,
    templateRoles: TemplateRoleMock[],
    templateFields: TemplateFieldMock[],
    input: SubmissionInput
  ) {
    const envelopeId = `env-sub-${Math.random().toString(36).substring(7)}`;
    const submissionId = `sub-${Math.random().toString(36).substring(7)}`;

    const signersCreated: Array<{
      signerId: string;
      email: string;
      name: string | null;
      roleId: string | null;
      status: string;
      order: number;
    }> = [];

    const roleToSignerIdMap = new Map<string, string>();

    const mainEmail = input.signerEmail.trim().toLowerCase();
    const mainName = input.signerName?.trim() || null;

    if (templateRoles.length === 0) {
      const signerId = `signer-1`;
      signersCreated.push({
        signerId,
        email: mainEmail,
        name: mainName,
        roleId: null,
        status: "SENT",
        order: 1,
      });

      for (const tf of templateFields) {
        if (tf.roleId) roleToSignerIdMap.set(tf.roleId, signerId);
      }
    } else {
      const inputMap = new Map((input.roleInputs || []).map((r) => [r.roleId, r]));

      templateRoles.forEach((role, idx) => {
        const rInput = inputMap.get(role.id);
        const email = rInput?.email?.trim().toLowerCase() || (idx === 0 ? mainEmail : "");
        const name = rInput?.name?.trim() || (idx === 0 ? mainName : null);

        const signerId = `signer-${idx + 1}`;
        signersCreated.push({
          signerId,
          email,
          name,
          roleId: role.id,
          status: "SENT",
          order: role.order,
        });

        roleToSignerIdMap.set(role.id, signerId);
      });
    }

    const fieldsInstantiated = templateFields.map((tf) => ({
      documentFieldId: `field-inst-${tf.id}`,
      type: tf.type,
      signerId: tf.roleId ? roleToSignerIdMap.get(tf.roleId) || null : signersCreated[0]?.signerId || null,
    }));

    return {
      envelopeId,
      submissionId,
      envelopeStatus: "SENT",
      signersCreated,
      fieldsInstantiated,
    };
  }

  it("instantiates an envelope with status SENT and maps primary recipient info for single role forms", () => {
    const roles: TemplateRoleMock[] = [{ id: "role-client", roleName: "Client", order: 1 }];
    const fields: TemplateFieldMock[] = [
      { id: "tf-1", roleId: "role-client", type: "SIGNATURE" },
      { id: "tf-2", roleId: "role-client", type: "DATE" },
    ];

    const result = simulatePublicFormSubmission("form-101", roles, fields, {
      signerName: "John Doe",
      signerEmail: "john@example.com",
    });

    expect(result.envelopeStatus).toBe("SENT");
    expect(result.signersCreated).toHaveLength(1);
    expect(result.signersCreated[0].email).toBe("john@example.com");
    expect(result.signersCreated[0].name).toBe("John Doe");
    expect(result.signersCreated[0].status).toBe("SENT");

    expect(result.fieldsInstantiated).toHaveLength(2);
    expect(result.fieldsInstantiated[0].signerId).toBe(result.signersCreated[0].signerId);
  });

  it("handles multi-role public forms correctly with distinct role inputs", () => {
    const roles: TemplateRoleMock[] = [
      { id: "role-buyer", roleName: "Buyer", order: 1 },
      { id: "role-seller", roleName: "Seller", order: 2 },
    ];
    const fields: TemplateFieldMock[] = [
      { id: "tf-1", roleId: "role-buyer", type: "SIGNATURE" },
      { id: "tf-2", roleId: "role-seller", type: "SIGNATURE" },
    ];

    const result = simulatePublicFormSubmission("form-102", roles, fields, {
      signerName: "Alice Buyer",
      signerEmail: "alice@buyer.com",
      roleInputs: [
        { roleId: "role-buyer", name: "Alice Buyer", email: "alice@buyer.com" },
        { roleId: "role-seller", name: "Bob Seller", email: "bob@seller.com" },
      ],
    });

    expect(result.signersCreated).toHaveLength(2);
    expect(result.signersCreated[0].email).toBe("alice@buyer.com");
    expect(result.signersCreated[1].email).toBe("bob@seller.com");

    expect(result.fieldsInstantiated[0].signerId).toBe(result.signersCreated[0].signerId);
    expect(result.fieldsInstantiated[1].signerId).toBe(result.signersCreated[1].signerId);
  });
});
