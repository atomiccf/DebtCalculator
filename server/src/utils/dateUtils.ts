export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getYearDivisorForDate(date: Date | string): number {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  return isLeapYear(year) ? 366 : 365;
}

export function getYearDivisorForPeriod(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  // Если период в пределах одного года
  if (startYear === endYear) {
    return isLeapYear(startYear) ? 366 : 365;
  }
  
  // Для периодов spanning multiple years, используем 365 как консервативное значение
  // В реальном приложении можно сделать более сложную логику
  return 365;
}