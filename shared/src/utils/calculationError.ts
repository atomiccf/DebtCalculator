/** Expected calculation restrictions, safe to expose as request errors. */
export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}
