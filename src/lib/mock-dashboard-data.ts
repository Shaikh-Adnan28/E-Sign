// Development-only mock data for UI preview when database contains 0 records.

export interface MockSigner {
  name: string
  email: string
  status: "PENDING" | "SENT" | "DELIVERED" | "VIEWED" | "SIGNED" | "DECLINED" | "EXPIRED"
}

export interface MockEnvelope {
  id: string
  title: string
  status: "DRAFT" | "SENT" | "DELIVERED" | "VIEWED" | "PARTIALLY_SIGNED" | "COMPLETED" | "DECLINED" | "EXPIRED" | "CANCELLED"
  createdAt: Date
  signers: MockSigner[]
  filename?: string
  fileSize?: string
}

export interface MockActivity {
  id: string
  envelopeId: string
  event: string
  actor: string | null
  envelopeTitle: string
  createdAt: Date
}

export const MOCK_STATS = {
  pending: 4,
  sentThisMonth: 12,
  completed: 18,
  completionRate: 82,
}

export const MOCK_ENVELOPES: MockEnvelope[] = [
  {
    id: "mock-env-1",
    title: "Senior Software Engineer Employment Agreement",
    status: "VIEWED",
    createdAt: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
    filename: "Employment_Agreement_2026.pdf",
    fileSize: "2.4 MB",
    signers: [
      { name: "John Smith", email: "john.smith@acme.inc", status: "VIEWED" },
      { name: "Sarah Williams", email: "sarah.w@acme.inc", status: "SIGNED" },
    ],
  },
  {
    id: "mock-env-2",
    title: "Mutual Non-Disclosure Agreement (NDA)",
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    filename: "Mutual_NDA_V3.pdf",
    fileSize: "1.1 MB",
    signers: [
      { name: "Alex Rivera", email: "alex.rivera@techcorp.io", status: "SIGNED" },
    ],
  },
  {
    id: "mock-env-3",
    title: "Q4 Master Services Consulting Agreement",
    status: "PARTIALLY_SIGNED",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    filename: "Services_Agreement_Q4.pdf",
    fileSize: "4.8 MB",
    signers: [
      { name: "Michael Brown", email: "mbrown@apexsolutions.com", status: "SIGNED" },
      { name: "Elena Rostova", email: "elena@apexsolutions.com", status: "PENDING" },
    ],
  },
  {
    id: "mock-env-4",
    title: "Enterprise Software License Addendum",
    status: "SENT",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28), // 1 day ago
    filename: "License_Addendum_signed.pdf",
    fileSize: "890 KB",
    signers: [
      { name: "David Miller", email: "david.miller@enterprise.org", status: "SENT" },
    ],
  },
  {
    id: "mock-env-5",
    title: "Independent Contractor Offer Letter",
    status: "DRAFT",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    filename: "Contractor_Offer_Draft.pdf",
    fileSize: "1.5 MB",
    signers: [
      { name: "Rachel Chen", email: "rachel.c@freelance.dev", status: "PENDING" },
    ],
  },
]

export const MOCK_ACTIVITIES: MockActivity[] = [
  {
    id: "mock-act-1",
    envelopeId: "mock-env-1",
    event: "signer.viewed",
    actor: "John Smith",
    envelopeTitle: "Senior Software Engineer Employment Agreement",
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: "mock-act-2",
    envelopeId: "mock-env-1",
    event: "signer.signed",
    actor: "Sarah Williams",
    envelopeTitle: "Senior Software Engineer Employment Agreement",
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: "mock-act-3",
    envelopeId: "mock-env-2",
    event: "document.completed",
    actor: "Alex Rivera",
    envelopeTitle: "Mutual Non-Disclosure Agreement (NDA)",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "mock-act-5",
    envelopeId: "mock-env-4",
    event: "document.sent",
    actor: "You",
    envelopeTitle: "Enterprise Software License Addendum",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28),
  },
]
export interface MockTemplateRole {
  id: string
  roleName: string
  order: number
}

export interface MockTemplateField {
  id: string
  roleId: string | null
  type: "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX"
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
}

export interface MockTemplate {
  id: string
  name: string
  description: string | null
  filename: string
  pageCount: number
  usageCount: number
  status: "ACTIVE" | "ARCHIVED"
  createdAt: Date
  updatedAt: Date
  roles: MockTemplateRole[]
  fields: MockTemplateField[]
}

export const MOCK_TEMPLATES: MockTemplate[] = [
  {
    id: "mock-tmpl-1",
    name: "Standard Employment Agreement",
    description: "Standard full-time employment contract with non-compete and IP assignment clauses.",
    filename: "Employment_Agreement_Template.pdf",
    pageCount: 4,
    usageCount: 24,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    roles: [
      { id: "role-1", roleName: "Employee", order: 1 },
      { id: "role-2", roleName: "Hiring Manager", order: 2 },
    ],
    fields: [
      { id: "f-1", roleId: "role-1", type: "SIGNATURE", pageNumber: 4, x: 0.1, y: 0.7, width: 0.35, height: 0.08, required: true },
      { id: "f-2", roleId: "role-1", type: "TEXT", pageNumber: 4, x: 0.1, y: 0.6, width: 0.35, height: 0.04, required: true },
      { id: "f-3", roleId: "role-1", type: "DATE", pageNumber: 4, x: 0.1, y: 0.8, width: 0.25, height: 0.04, required: true },
      { id: "f-4", roleId: "role-2", type: "SIGNATURE", pageNumber: 4, x: 0.55, y: 0.7, width: 0.35, height: 0.08, required: true },
      { id: "f-5", roleId: "role-2", type: "DATE", pageNumber: 4, x: 0.55, y: 0.8, width: 0.25, height: 0.04, required: true },
    ],
  },
  {
    id: "mock-tmpl-2",
    name: "Standard Mutual NDA",
    description: "Bilateral non-disclosure agreement for prospective business discussions and partnerships.",
    filename: "Mutual_NDA_Standard.pdf",
    pageCount: 2,
    usageCount: 56,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    roles: [
      { id: "role-1", roleName: "Party A (Disclosing)", order: 1 },
      { id: "role-2", roleName: "Party B (Receiving)", order: 2 },
    ],
    fields: [
      { id: "f-6", roleId: "role-1", type: "SIGNATURE", pageNumber: 2, x: 0.1, y: 0.75, width: 0.35, height: 0.08, required: true },
      { id: "f-7", roleId: "role-2", type: "SIGNATURE", pageNumber: 2, x: 0.55, y: 0.75, width: 0.35, height: 0.08, required: true },
    ],
  },
  {
    id: "mock-tmpl-3",
    name: "Independent Contractor Agreement",
    description: "Statement of work and contractor terms for 1099 freelancers.",
    filename: "Contractor_SOW_Template.pdf",
    pageCount: 3,
    usageCount: 12,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    roles: [
      { id: "role-1", roleName: "Contractor", order: 1 },
      { id: "role-2", roleName: "Client Representative", order: 2 },
    ],
    fields: [
      { id: "f-8", roleId: "role-1", type: "SIGNATURE", pageNumber: 3, x: 0.1, y: 0.7, width: 0.35, height: 0.08, required: true },
      { id: "f-9", roleId: "role-2", type: "SIGNATURE", pageNumber: 3, x: 0.55, y: 0.7, width: 0.35, height: 0.08, required: true },
    ],
  },
]

