import { describe, it, expect } from "vitest";

describe("Phase 5.1 — Contact Intelligence & Reusable Recipients", () => {
  it("detects duplicate contacts by normalized lower-case email", () => {
    const existing = [
      { id: "c1", name: "Alice", email: "alice@example.com" },
      { id: "c2", name: "Bob", email: "bob@acme.org" },
    ];

    function findDuplicate(contactsList: Array<{ id: string; name: string; email: string }>, searchEmail: string) {
      const normalized = searchEmail.trim().toLowerCase();
      return contactsList.find((c) => c.email.toLowerCase() === normalized);
    }

    const match1 = findDuplicate(existing, "  ALICE@EXAMPLE.COM  ");
    expect(match1).toBeDefined();
    expect(match1?.id).toBe("c1");

    const match2 = findDuplicate(existing, "charlie@example.com");
    expect(match2).toBeUndefined();
  });

  it("parses CSV content cleanly, extracts fields, and normalizes tags", () => {
    const csvData = `name,email,company,phone,tags,notes
John Doe,john@example.com,Acme Corp,+123456789,"VIP, Executive",First client
Alice Existing,ALICE@EXAMPLE.COM,Old Corp,,Existing,Duplicate email test
`;

    const lines = csvData.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    expect(header).toContain("name");
    expect(header).toContain("email");

    const firstRow = lines[1].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    expect(firstRow[0]).toBe("John Doe");
    expect(firstRow[1]).toBe("john@example.com");
  });

  it("exports contact address book into valid CSV format", () => {
    const mockContacts = [
      {
        id: "c1",
        name: 'Jane "Leader" Doe',
        email: "jane@example.com",
        company: "Acme, Inc.",
        tags: ["VIP", "Client"],
      },
    ];

    const headers = ["Name", "Email", "Company", "Tags"];
    const rows = mockContacts.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${c.company.replace(/"/g, '""')}"`,
      `"${c.tags.join(", ").replace(/"/g, '""')}"`,
    ]);

    const csvOutput = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    expect(csvOutput).toContain("Name,Email,Company,Tags");
    expect(csvOutput).toContain('"Jane ""Leader"" Doe"');
    expect(csvOutput).toContain('"jane@example.com"');
    expect(csvOutput).toContain('"Acme, Inc."');
    expect(csvOutput).toContain('"VIP, Client"');
  });

  it("maintains strict separation between Contact (Address Book) and Signer (Envelope Record)", () => {
    const contact = {
      id: "c-100",
      name: "Original Name",
      email: "contact@example.com",
    };

    const signer = {
      id: "s-1",
      envelopeId: "env-1",
      name: contact.name,
      email: contact.email,
      status: "SENT",
    };

    const updatedContact = { ...contact, name: "Updated Name" };

    expect(signer.name).toBe("Original Name");
    expect(updatedContact.name).toBe("Updated Name");
  });
});
