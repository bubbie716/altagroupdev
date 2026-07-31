# AT-LEGAL-006 — Alta Terminal Crypto Trading and Custody Disclosure

**Entity:** Alta Terminal LLC  
**Document ID:** AT-LEGAL-006  
**Version:** 1.1
**Status:** Effective when acknowledged by a customer before crypto trading  
**Acceptance type:** Acknowledged  
**Last Updated:** July 31, 2026

---

## 1. Purpose

This disclosure explains how fictional Alta Terminal crypto instruments work, how Alta operates their internal market and custody records, and the material conflicts and risks involved. It supplements the Alta Terminal Customer Agreement, Trading and Order Handling Terms, Risk Disclosure, and Fee Schedule. Acknowledge it before placing crypto trades or enabling scheduled crypto instructions.

## 2. Fictional Minecraft Economy Only

NPFC, NVA, VLT, and any other Alta Terminal crypto instruments are fictional, florin-denominated Minecraft / roleplay economy instruments operated by Alta Terminal.

They have no real-world monetary value, are not legal tender, bank deposits, securities, cryptocurrencies, or financial products under real-world law, and are not connected to any real-world blockchain, exchange, wallet network, or payment rail.

## 3. Custodial Internal Ledger

Alta operates a custodial internal ledger for Terminal crypto balances. Coin quantities are recorded only in Alta’s books.

A portfolio crypto wallet is an Alta ledger wallet created automatically on the first successful crypto purchase for that portfolio. Wallet public IDs (for example `acw_…`) are internal identifiers. They are not blockchain addresses, and there are no private keys, seed phrases, gas fees, or external deposits, withdrawals, or transfers.

Customer-to-customer coin transfers, crypto payments, external deposits or withdrawals, and external wallet transfers are not supported at this time. A displayed wallet ID cannot receive value from outside Alta Terminal and does not prove ownership of a blockchain asset.

Alta’s authoritative ledger, rather than a blockchain or Customer-controlled key, determines the recorded wallet and coin balance. Access may be delayed or frozen while an authorization, security, reconciliation, or ledger issue is investigated.

## 4. Newport Florin Coin (NPFC)

NPFC is a stable instrument pegged at ƒ1.00.

- Purchases mint NPFC against florins deposited into a protected NPFC reserve after the disclosed conversion fee.
- Redemptions burn NPFC and return florins from that protected reserve after the disclosed conversion fee.
- The protected reserve is intended to cover circulating NPFC at ƒ1 each.
- Rounding excess remains protected in the reserve.

NPFC’s florin backing does not make it real-world currency or government money.

The protected NPFC reserve is an internal Alta ledger balance, not a real-world trust, escrow account, insured deposit, or government reserve. Alta intends to maintain one protected Florin of reserve liability for each circulating NPFC, but immediate purchase or redemption is not guaranteed. Redemption may be delayed or unavailable during a halt, reconciliation issue, security event, insufficient confirmed reserve, technical failure, or asset closure procedure.

## 5. Nova Coin (NVA) and Volt Coin (VLT)

NVA and VLT use reserve-backed bonding-curve pricing. Marginal price rises when coins are purchased into circulation and falls when coins are sold back to the Alta treasury inventory.

- Displayed marginal price can differ from the average execution price of a trade.
- Large purchases or sales can move price sharply.
- Liquidity for sells comes from each asset’s protected curve reserve.
- Loss of florins is possible when trading NVA or VLT.

NVA and VLT are initially held as Alta treasury inventory. A purchase moves quantity from treasury inventory into Customer circulation and adds the applicable net Florins to the protected curve reserve. A sale returns quantity to treasury inventory and pays eligible proceeds from that reserve. Customers do not own the treasury inventory, protected reserve, pricing formula, or stabilization balance.

There is no public order book or independent counterparty setting the price. Alta establishes the disclosed bonding-curve configuration and executes purchases and sales against its own internal market state.

## 6. Market Orders and Quotes

Crypto trading uses market orders that execute immediately against the current Alta Crypto market state while an asset is operational. Crypto trading may be available 24/7 when the asset status allows it.

Review quotes are estimates. They can expire, become stale, or require re-quoting if the market state changes before submission. Alta recomputes execution authoritatively at submit time.

A displayed marginal price is not the price for every coin in an order. Average execution price is calculated across the quantity purchased or sold under the applicable pricing formula. A price-impact warning or acknowledgement is informational and does not establish a maximum execution price, minimum proceeds, or guaranteed outcome.

## 7. Scheduled and Recurring Crypto Trades

Scheduled or recurring crypto instructions create future attempts to submit market orders. Each attempt uses the then-current market state, price, wallet balance, portfolio cash, asset status, consent, limits, and controls. The quote displayed when a schedule is created is not reserved for a future attempt.

An attempt may be skipped, delayed, rejected, or failed. Under the current control policy, an automated attempt is skipped when estimated price impact is 10% or greater rather than requesting an unattended high-impact acknowledgement. Cancelling or pausing a schedule does not reverse an order that has already executed.

## 8. Fees

Unless a later schedule supersedes this disclosure:

- NVA and VLT: 1.00% of gross trade value per completed buy or sell, allocated 0.75% to Alta Terminal revenue and 0.25% to that asset’s stabilization fund.
- NPFC: 0.10% conversion fee on purchases and redemptions, allocated to Alta Terminal revenue.

Failed, rejected, cancelled, or skipped instructions incur no fee.

The current Alta Terminal Fee Schedule controls if it conflicts with a fee summary in this disclosure. A stabilization allocation is an internal Alta balance. It is not Customer property and does not guarantee that Alta will support an asset’s price, supply liquidity, reimburse a loss, or use the balance for a particular Customer.

## 9. Asset Status and Operational Controls

An Alta Crypto asset may be Draft, Active, Halted, Redemption Only, or Closed. Displayed status and trade capabilities control what a Customer can do at any time.

- Draft assets are not available for production trading.
- Active assets may accept the enabled purchase and sale instructions.
- Halted assets do not accept ordinary trading while the halt remains in effect.
- Redemption Only assets permit only the displayed exit or redemption activity.
- Closed assets do not accept new trading and may be subject to a separately announced wind-down or correction process.

Alta may halt trading, allow redemptions only, reconcile records, apply risk limits, reject unsafe instructions, correct ledger errors through auditable reversing entries, or close an asset under disclosed rules. A status change can prevent a Customer from buying or selling when desired. Closure does not guarantee that every remaining holding can be redeemed at a prior displayed price.

## 10. Market Data and Price History

Alta Crypto quotes, supply figures, reserve figures, charts, candles, returns, and portfolio marks are calculated from Alta’s internal configuration, ledger, and completed trades. They are not third-party blockchain data or prices from an independent exchange.

Trading may be available continuously, but continuous availability does not mean continuous activity. A thinly traded asset may have sparse, flat, stale-looking, or sharply changing price history. A chart or marked value is informational and does not guarantee that an order can execute for that amount.

## 11. Alta’s Roles and Conflicts

Alta Terminal or an Alta affiliate may simultaneously act as instrument issuer or administrator, treasury-inventory holder, internal venue operator, custodial ledger operator, reserve administrator, stabilization-fund administrator, technology provider, and fee recipient.

These overlapping roles create conflicts. Alta establishes the instrument configuration and operational controls, earns disclosed fees, maintains the authoritative records, and may decide when to halt, restrict, move to redemption-only status, correct, or close an asset. There is no independent exchange, blockchain validator, market maker, custodian, or clearing organization checking each decision.

Alta will record material lifecycle and money movements through its operational and audit systems, but those controls do not eliminate conflicts, errors, misuse, or loss.

## 12. Reconciliation, Errors, and Corrections

Alta reconciles wallet balances, supply, treasury inventory, reserves, fees, settlements, and cash-ledger entries. A discrepancy may cause trading restrictions, delayed availability, a temporary freeze, or investigation.

Alta may correct duplicate, missing, unauthorized, malformed, or clearly erroneous activity using auditable entries or reversals. A correction can change displayed cash, coin quantity, cost basis, proceeds, fees, price history, or portfolio value. Customers must promptly report unexpected activity and must not knowingly retain value created by an obvious error.

## 13. Conduct and Market Integrity

Customers may not manipulate or attempt to manipulate Alta Crypto through wash trading, coordinated artificial activity, deceptive orders, unauthorized automation, exploitation of stale quotes, duplicate submissions, race conditions, reserve or pricing errors, account compromise, or evasion of limits and status controls.

Alta may restrict accounts, wallets, instruments, or schedules while suspected manipulation, abuse, or a security event is investigated.

## 14. Risk of Loss and No Guarantee

Crypto holdings may lose some or all of their fictional Florin value. Alta does not guarantee price, liquidity, reserve sufficiency at every moment, redemption timing, continuous operation, stabilization support, profitable trading, or recovery from a platform or community failure.

NPFC’s target price and protected reserve design do not create deposit insurance or an unconditional payment obligation. NVA and VLT stabilization balances do not impose a duty to intervene in the market or compensate Customers.

## 15. Acknowledgement

By acknowledging this disclosure, you confirm that you understand these instruments are fictional Minecraft-economy products; Alta operates the internal market, custody ledger, reserves, and controls while receiving fees; there is no blockchain, public order book, or independent custodian; NVA and VLT prices can move materially; NPFC redemption and stabilization support are not guaranteed; quotes and scheduled attempts can change or fail; and Florin losses are possible.

**Adopted by:** Alta Terminal LLC
**Approved by:** Alta Group N.V.
**Version:** 1.1
**Last Updated:** July 31, 2026
