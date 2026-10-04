import type { Deviation, GurpsCharacter } from './character.generated.js';
import { recompute, deviations, plainValue } from './formula.js';
import { schema } from './schemas.js';

/** An unpaid override: a value that differs from its formula with no cost paying for it. */
export type ReportedDeviation = Pick<Deviation, 'pointer' | 'expected' | 'actual' | 'justification'>;
/** A derived value that doesn't add up: the file was edited by hand. */
export type Inconsistency = Pick<Deviation, 'pointer' | 'expected' | 'actual'>;
export interface RuleIssue { code: 'overBudget'; pointer: string; message: string }

export interface VerificationReport {
  /** Recomputed from the rule formulas: no deviations, no inconsistencies, no issues. */
  rulesCompliant: boolean;
  /** Declared by the player (integrity.experimental): validations were relaxed on purpose. */
  experimental: boolean;
  /** What the file claims (null when it has no integrity block, e.g. format 1.0). */
  declaredCompliant: boolean | null;
  /** The claim matches the recomputation (true when nothing is claimed). */
  claimConsistent: boolean;
  deviations: ReportedDeviation[];
  inconsistencies: Inconsistency[];
  issues: RuleIssue[];
}

/**
 * Independent rule check. Recomputes every value from the schema formulas and never trusts the document's
 * own `integrity` block — it only compares against it (`claimConsistent`).
 */
export function verifyCharacter(doc: GurpsCharacter): VerificationReport {
  const results = recompute(schema, doc);
  const found = deviations(schema, doc, results);
  const reasons = new Map((doc.integrity?.deviations ?? []).flatMap((d) => (d.justification ? [[d.pointer, d.justification] as const] : [])));
  const overrides = found.filter((d) => d.reason === 'override')
    .map(({ pointer, expected, actual }): ReportedDeviation => {
      const justification = reasons.get(pointer);
      return { pointer, expected, actual, ...(justification !== undefined ? { justification } : {}) };
    });
  const inconsistencies = found.filter((d) => d.reason === 'inconsistent').map(({ pointer, expected, actual }) => ({ pointer, expected, actual }));

  const issues: RuleIssue[] = [];
  const computed = plainValue(results.find((r) => r.pointer === '/points/spent')?.computed);
  const spent = typeof computed === 'number' ? computed : doc.points.spent; // recomputed, not trusted
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
