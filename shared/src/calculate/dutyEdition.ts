import type { RulesSnapshot } from '../referenceData/rules';
import type { CourtRatesConfig } from './commonCourts';
import type { EconomicRatesConfig } from './economicCourts';

/** Serializable metadata identifying a reviewed tariff edition. */
export interface DutyRules extends RulesSnapshot {
  readonly dateFrom: string;
  readonly supportedYear?: number;
}

export type DutyRatesConfig = CourtRatesConfig | EconomicRatesConfig;

/** One complete edition, including its property, fixed and complaint tariffs. */
export interface DutyEdition {
  readonly rules: DutyRules;
  /** Receives validated facts and exact duty units; must not round to kopecks. */
  readonly calculateUnits: (config: DutyRatesConfig, baseValue: bigint, amount?: bigint) => bigint;
}
