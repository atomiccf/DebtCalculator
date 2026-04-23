const API_URL = 'http://localhost:3000'

export const API_ENDPOINTS = {
  DUTY_CALCULATE: '/api/duty/calculate',
  DUTY_CASE_TYPES: '/api/duty/case-types',
  PENALTY_CALCULATE_MULTIPLE: '/api/penalty/calculate-multiple',
  INTEREST_366_MULTIPLE: '/api/interest/calculate-366-multiple',
  RATES_CURRENT: '/api/rates/current',
} as const

export { API_URL }