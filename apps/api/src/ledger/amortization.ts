export type AmortizedPayment = {
  amount: number;
  interestPortion: number;
  principalPortion: number;
  resultingBalance: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function monthlyRate(annualRatePercent: number) {
  return annualRatePercent / 100 / 12;
}

export function expectedEmi(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
) {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = monthlyRate(annualRatePercent);
  if (r === 0) return roundMoney(principal / tenureMonths);
  const factor = Math.pow(1 + r, tenureMonths);
  return roundMoney((principal * r * factor) / (factor - 1));
}

export function amortizePayment(
  balance: number,
  annualRatePercent: number,
  emiAmount: number,
): AmortizedPayment {
  const interestPortion = roundMoney(balance * monthlyRate(annualRatePercent));
  const principalPortion = roundMoney(
    Math.min(balance, Math.max(emiAmount - interestPortion, 0)),
  );
  return {
    amount: roundMoney(emiAmount),
    interestPortion,
    principalPortion,
    resultingBalance: roundMoney(Math.max(balance - principalPortion, 0)),
  };
}

export function applyPrincipalPayment(
  balance: number,
  amount: number,
): AmortizedPayment {
  const principalPortion = roundMoney(Math.min(balance, amount));
  return {
    amount: roundMoney(amount),
    interestPortion: 0,
    principalPortion,
    resultingBalance: roundMoney(Math.max(balance - principalPortion, 0)),
  };
}

export function projectedPayoffMonths(
  balance: number,
  annualRatePercent: number,
  emiAmount: number,
  maxMonths = 600,
) {
  let remaining = roundMoney(balance);
  let months = 0;

  while (remaining > 0 && months < maxMonths) {
    const next = amortizePayment(remaining, annualRatePercent, emiAmount);
    if (next.principalPortion <= 0) return null;
    remaining = next.resultingBalance;
    months += 1;
  }

  return remaining <= 0 ? months : null;
}

export function emiWarning(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number | null | undefined,
  emiAmount: number | null | undefined,
) {
  if (!tenureMonths || !emiAmount || principal <= 0) return null;
  const expected = expectedEmi(principal, annualRatePercent, tenureMonths);
  const difference = roundMoney(emiAmount - expected);
  if (Math.abs(difference) <= Math.max(1, expected * 0.01)) return null;
  if (difference < 0) {
    return `EMI is ${Math.abs(difference).toFixed(2)} below the standard ${expected.toFixed(2)} estimate for this tenure.`;
  }
  return `EMI is ${difference.toFixed(2)} above the standard ${expected.toFixed(2)} estimate for this tenure.`;
}
