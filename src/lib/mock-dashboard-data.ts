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
    id: "mock-act-4",
    envelopeId: "mock-env-3",
    event: "signer.signed",
    actor: "Michael Brown",
    envelopeTitle: "Q4 Master Services Consulting Agreement",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
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
