/**
 * SUNAT Official Tax Calendar Helper for Nuevo RUS (Formulario 1611)
 * Calculates the exact deadline date based on the period (Year/Month)
 * and the last digit of the taxpayer's RUC.
 */

export interface SunatDeadlineInfo {
  periodMonth: number;
  periodYear: number;
  periodStr: string;      // "11/2025"
  monthKey: string;       // "2025-11"
  ruc: string;
  lastDigit: number;
  deadlineDate: Date;
  deadlineFormatted: string; // "19 de Diciembre 2025"
  deadlineShort: string;     // "19/12/2025"
  isOverdue: boolean;
  daysRemaining: number;
  status: 'DENTRO_DE_PLAZO' | 'VENCE_PRONTO' | 'VENCE_HOY' | 'VENCIDO';
}

/**
 * Approximate base calendar day in the following month according to SUNAT rules
 * 0 -> ~14
 * 1 -> ~15 (Peggy)
 * 2, 3 -> ~16
 * 4, 5 -> ~19 (Fabio)
 * 6, 7 -> ~20
 * 8, 9 -> ~21
 */
function getBaseDayForLastDigit(lastDigit: number): number {
  switch (lastDigit) {
    case 0: return 14;
    case 1: return 15;
    case 2:
    case 3: return 16;
    case 4:
    case 5: return 19;
    case 6:
    case 7: return 20;
    case 8:
    case 9: return 21;
    default: return 20;
  }
}

/**
 * Adjust date if it falls on Saturday or Sunday to the next business day (Monday)
 */
function adjustForWeekend(d: Date): Date {
  const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 6) {
    // Saturday -> Monday (+2 days)
    d.setDate(d.getDate() + 2);
  } else if (dayOfWeek === 0) {
    // Sunday -> Monday (+1 day)
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Calculate the official SUNAT deadline for a given period and RUC
 */
export function getSunatDeadline(
  periodYear: number,
  periodMonth: number, // 1 to 12
  ruc: string
): SunatDeadlineInfo {
  const cleanRuc = ruc.trim();
  const lastDigit = parseInt(cleanRuc.slice(-1), 10) || 0;

  // Due in the FOLLOWING month (M + 1)
  let dueYear = periodYear;
  let dueMonth = periodMonth; // 0-indexed month for Date constructor is periodMonth
  if (dueMonth > 11) {
    dueMonth = 0;
    dueYear += 1;
  }

  const baseDay = getBaseDayForLastDigit(lastDigit);
  let deadline = new Date(dueYear, dueMonth, baseDay, 23, 59, 59);
  deadline = adjustForWeekend(deadline);

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;

  let status: 'DENTRO_DE_PLAZO' | 'VENCE_PRONTO' | 'VENCE_HOY' | 'VENCIDO' = 'DENTRO_DE_PLAZO';
  if (isOverdue) {
    status = 'VENCIDO';
  } else if (daysRemaining === 0) {
    status = 'VENCE_HOY';
  } else if (daysRemaining <= 3) {
    status = 'VENCE_PRONTO';
  }

  const periodStr = `${String(periodMonth).padStart(2, '0')}/${periodYear}`;
  const monthKey = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const deadlineFormatted = `${deadline.getDate()} de ${monthNames[deadline.getMonth()]} ${deadline.getFullYear()}`;
  const deadlineShort = `${String(deadline.getDate()).padStart(2, '0')}/${String(deadline.getMonth() + 1).padStart(2, '0')}/${deadline.getFullYear()}`;

  return {
    periodMonth,
    periodYear,
    periodStr,
    monthKey,
    ruc: cleanRuc,
    lastDigit,
    deadlineDate: deadline,
    deadlineFormatted,
    deadlineShort,
    isOverdue,
    daysRemaining,
    status,
  };
}
