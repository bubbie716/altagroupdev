/**
 * Compatibility facade — institution helpers now live under NCC.
 * Prefer importing from `@/server/ncc/ncc-institution.service`.
 */
export {
  ensureAltaBankInstitutionSeeded,
  ensureAltaInstitutionsSeeded,
  getAltaBankInstitution,
  getAltaBankPrimaryRoutingNumber,
  getInstitutionPrimaryRouting,
  listActiveFinancialInstitutions,
} from "@/server/ncc/ncc-institution.service";
