/** Newport Clearing Corporation — institutional infrastructure palette. */
import { legalDocumentPath } from "@/lib/legal/legal-document-registry";

export const NCC = {
  green: "#0c4d32",
  greenDark: "#083d28",
  greenMuted: "#e8f2ed",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray400: "#9ca3af",
  gray600: "#4b5563",
  gray800: "#1f2937",
  gray900: "#111827",
  success: "#15803d",
  warning: "#ca8a04",
  critical: "#b91c1c",
} as const;

export const NCC_LEGAL_DOCS = [
  { id: "NCC-LEGAL-001", label: "Participation Agreement", path: legalDocumentPath("NCC-LEGAL-001") },
  { id: "NCC-LEGAL-002", label: "Operating Rules", path: legalDocumentPath("NCC-LEGAL-002") },
  { id: "NCC-LEGAL-003", label: "Fee Schedule", path: legalDocumentPath("NCC-LEGAL-003") },
] as const;

export const NCC_NETWORK_STATS = [
  { label: "Participating Institutions", value: "12" },
  { label: "Transfers Processed (30d)", value: "48,291" },
  { label: "Settlement Volume (30d)", value: "ƒ 2.4B" },
  { label: "Routing Numbers", value: "847" },
  { label: "Network Status", value: "Operational", status: "operational" as const },
] as const;

export const NCC_SERVICES = [
  {
    title: "Interbank Settlement",
    description: "Final settlement of interbank obligations across participating institutions.",
  },
  {
    title: "Payment Routing",
    description: "Institution-to-institution payment routing and message delivery.",
  },
  {
    title: "Institution Directory",
    description: "Authoritative registry of approved network participants and routing identifiers.",
  },
  {
    title: "Network Operations",
    description: "Operational monitoring, message validation, and network health management.",
  },
  {
    title: "Reserve Services",
    description: "Reserve account management and liquidity oversight for participants.",
  },
  {
    title: "Institution Management",
    description: "Onboarding, credentialing, and lifecycle management for network members.",
  },
] as const;

export const NCC_INSTITUTIONS = [
  {
    name: "Alta Bank N.V.",
    type: "Commercial Bank",
    status: "operational" as const,
    routing: "021000001",
  },
  {
    name: "Alta Exchange N.V.",
    type: "Securities Exchange",
    status: "operational" as const,
    routing: "021000002",
  },
  {
    name: "Newport Payment Services",
    type: "Payment Provider",
    status: "pending" as const,
    routing: "—",
  },
  {
    name: "Harbor Trust Company",
    type: "Trust Institution",
    status: "restricted" as const,
    routing: "021000004",
  },
] as const;
