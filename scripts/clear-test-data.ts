/**
 * Delete test/dummy transaction data so the shop can start clean.
 *
 * SAFE BY DEFAULT: running it with no flags only COUNTS what would be removed
 * and deletes nothing. You must pass --confirm for any row to be deleted.
 *
 * It never touches products, variants, categories, media, pages, promotions,
 * suppliers or settings — only transactional records.
 *
 *   npx ts-node scripts/clear-test-data.ts                  # dry run (default)
 *   npx ts-node scripts/clear-test-data.ts --confirm        # delete everything listed
 *   npx ts-node scripts/clear-test-data.ts --orders --confirm
 *   npx ts-node scripts/clear-test-data.ts --confirm --restore-stock
 *
 * Targets (default: all of them):
 *   --orders     Order
 *   --pos        PosTransaction
 *   --leads      CheckoutLead
 *   --crm        CrmCustomer
 *   --inventory  InventoryMovement
 *   --returns    ReturnExchange
 *   --views      ProductView
 *
 * --restore-stock  Only valid together with --inventory. Puts each variant's
 *                  stock_qty back to what it was before its earliest deleted
 *                  movement, undoing the stock these test sales consumed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);

const CONFIRM = has('--confirm');
const RESTORE_STOCK = has('--restore-stock');

type Target = { flag: string; label: string; count: () => Promise<number>; del: () => Promise<{ count: number }> };

const TARGETS: Target[] = [
  { flag: '--orders',    label: 'Orders',              count: () => prisma.order.count(),             del: () => prisma.order.deleteMany({}) },
  { flag: '--pos',       label: 'POS transactions',    count: () => prisma.posTransaction.count(),    del: () => prisma.posTransaction.deleteMany({}) },
  { flag: '--leads',     label: 'Checkout leads',      count: () => prisma.checkoutLead.count(),      del: () => prisma.checkoutLead.deleteMany({}) },
  { flag: '--crm',       label: 'CRM customers',       count: () => prisma.crmCustomer.count(),       del: () => prisma.crmCustomer.deleteMany({}) },
  { flag: '--inventory', label: 'Inventory movements', count: () => prisma.inventoryMovement.count(), del: () => prisma.inventoryMovement.deleteMany({}) },
  { flag: '--returns',   label: 'Returns / exchanges', count: () => prisma.returnExchange.count(),    del: () => prisma.returnExchange.deleteMany({}) },
  { flag: '--views',     label: 'Product views',       count: () => prisma.productView.count(),       del: () => prisma.productView.deleteMany({}) },
];

// If no specific target flag is given, every target is selected.
const explicit = TARGETS.filter((t) => has(t.flag));
const selected = explicit.length > 0 ? explicit : TARGETS;

function line() { console.log('─'.repeat(56)); }

/**
 * Undo the stock these movements consumed.
 *
 * Every InventoryMovement stores before_qty, so the stock a variant had before
 * ANY of its movements is the before_qty of its earliest one. Since this script
 * removes all movements, resetting each variant to that value returns stock to
 * its pre-test state exactly.
 */
async function restoreStock(dryRun: boolean) {
  const movements = await prisma.inventoryMovement.findMany({
    select: { variant_id: true, before_qty: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });

  const earliest = new Map<string, number>();
  for (const m of movements) {
    if (!earliest.has(m.variant_id)) earliest.set(m.variant_id, m.before_qty);
  }
  if (earliest.size === 0) {
    console.log('  (no movements — nothing to restore)');
    return;
  }

  const ids = [...earliest.keys()];
  const current = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    select: { id: true, sku: true, stock_qty: true },
  });

  let changed = 0;
  for (const v of current) {
    const target = earliest.get(v.id)!;
    if (v.stock_qty === target) continue;
    changed++;
    console.log(`  ${v.sku}: ${v.stock_qty} → ${target}`);
    if (!dryRun) {
      await prisma.productVariant.update({ where: { id: v.id }, data: { stock_qty: target } });
    }
  }
  if (changed === 0) console.log('  (all variants already at their pre-test stock)');
  else console.log(`  ${dryRun ? 'would restore' : 'restored'} stock on ${changed} variant(s)`);
}

async function main() {
  line();
  console.log(CONFIRM ? '  DELETING TEST DATA' : '  DRY RUN — nothing will be deleted');
  console.log(`  Database: ${(process.env.DATABASE_URL ?? '').replace(/:\/\/.*@/, '://***@') || '(DATABASE_URL not set!)'}`);
  line();

  if (RESTORE_STOCK && !selected.some((t) => t.flag === '--inventory')) {
    console.error('ERROR: --restore-stock needs --inventory (or no target flags, which selects everything).');
    process.exitCode = 1;
    return;
  }

  const counts: Array<{ label: string; before: number; target: Target }> = [];
  for (const t of selected) {
    counts.push({ label: t.label, before: await t.count(), target: t });
  }

  console.log('  Rows found:');
  for (const c of counts) console.log(`    ${c.label.padEnd(22)} ${String(c.before).padStart(6)}`);
  const total = counts.reduce((s, c) => s + c.before, 0);
  line();

  if (total === 0) {
    console.log('  Nothing to delete — already clean.');
    return;
  }

  if (RESTORE_STOCK) {
    console.log(CONFIRM ? '  Restoring stock:' : '  Stock that WOULD be restored:');
    await restoreStock(!CONFIRM);
    line();
  }

  if (!CONFIRM) {
    console.log(`  ${total} row(s) would be deleted.`);
    console.log('  Re-run with --confirm to actually delete them.');
    console.log('  BACK UP THE DATABASE FIRST — this cannot be undone.');
    line();
    return;
  }

  for (const c of counts) {
    if (c.before === 0) { console.log(`    ${c.label.padEnd(22)} skipped (empty)`); continue; }
    const res = await c.target.del();
    console.log(`    ${c.label.padEnd(22)} deleted ${res.count}`);
  }

  line();
  console.log('  Done. Verifying...');
  for (const c of counts) {
    const after = await c.target.count();
    console.log(`    ${c.label.padEnd(22)} now ${after}${after === 0 ? '' : '  <-- NOT EMPTY'}`);
  }
  line();
}

main()
  .catch((e) => { console.error('\nFAILED — no partial cleanup was committed beyond what is listed above.\n', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
