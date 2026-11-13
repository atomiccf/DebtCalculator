/** A law edition or an arithmetic algorithm; support bounds are explicit where applicable. */
export interface RulesSnapshot {
  readonly version: string;
  readonly source: string;
  readonly provisions: string;
  readonly verifiedOn?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly supportedThrough?: string;
}
