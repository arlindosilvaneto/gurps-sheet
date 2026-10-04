import schema from '../schema/gurps-character.schema.json' with { type: 'json' };
import { recompute, deviations } from './formula.js';

const plain = (x) => (x && typeof x === 'object' && 'notation' in x ? x.notation : x ?? null);

/**
 * Independent rule check. Recomputes every value from the schema formulas and never trusts the document's
 * own `integrity` block — it only compares against it (`claimConsistent`).
 *
 * @returns {{
 *   rulesCompliant: boolean,             // recomputed: no deviations, no inconsistencies, no issues
 *   experimental: boolean,               // declared by the player (integrity.experimental)
 *   declaredCompliant: boolean|null,     // what the file claims (null when it has no integrity block, e.g. 1.0)
 *   claimConsistent: boolean,            // the claim matches the recomputation (true when nothing is claimed)
 *   deviations: Array<{ pointer, expected, actual, justification? }>,  // unpaid overrides (hand-edited values)
 *   inconsistencies: Array<{ pointer, expected, actual }>,             // derived values that don't add up (file edited by hand)
 *   issues: Array<{ code: 'overBudget', pointer, message }>
 * }}
 */
export function verifyCharacter(doc) {
  const results = recompute(schema, doc);
  const found = deviations(schema, doc, results);
  const reasons = new Map((doc.integrity?.deviations ?? []).filter((d) => d.justification).map((d) => [d.pointer, d.justification]));
  const overrides = found.filter((d) => d.reason === 'override')
    .map(({ pointer, expected, actual }) => ({ pointer, expected, actual, ...(reasons.has(pointer) ? { justification: reasons.get(pointer) } : {}) }));
  const inconsistencies = found.filter((d) => d.reason === 'inconsistent').map(({ pointer, expected, actual }) => ({ pointer, expected, actual }));

  const issues = [];
  const spent = plain(results.find((r) => r.pointer === '/points/spent')?.computed) ?? doc.points.spent; // recomputed, not trusted
  const budget = doc.points.budget;
  if (typeof budget === 'number' && spent > budget) {
    issues.push({ code: 'overBudget', pointer: '/points/spent', message: `Points spent (${spent}) exceed the budget (${budget}) by ${spent - budget}.` });
  }

  const rulesCompliant = overrides.length === 0 && inconsistencies.length === 0 && issues.length === 0;
  const declaredCompliant = doc.integrity ? doc.integrity.rulesCompliant : null;
  return {
    rulesCompliant,
    experimental: doc.integrity?.experimental === true,
    declaredCompliant,
    claimConsistent: declaredCompliant === null || declaredCompliant === rulesCompliant,
    deviations: overrides,
    inconsistencies,
    issues,
  };
}
