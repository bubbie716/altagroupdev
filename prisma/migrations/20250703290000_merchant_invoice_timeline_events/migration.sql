-- Company relationship timeline events for merchant invoices

ALTER TYPE "CompanyRelationshipTimelineEventType" ADD VALUE 'MERCHANT_INVOICE_SENT';
ALTER TYPE "CompanyRelationshipTimelineEventType" ADD VALUE 'MERCHANT_INVOICE_PAID';
