import {
  amortizePayment,
  applyPrincipalPayment,
  emiWarning,
  expectedEmi,
  projectedPayoffMonths,
} from './amortization';

describe('amortization', () => {
  it('calculates the standard EMI formula', () => {
    expect(expectedEmi(100000, 12, 12)).toBe(8884.88);
  });

  it('splits EMI into interest and principal portions', () => {
    expect(amortizePayment(100000, 12, 8884.88)).toEqual({
      amount: 8884.88,
      interestPortion: 1000,
      principalPortion: 7884.88,
      resultingBalance: 92115.12,
    });
  });

  it('applies extra payments fully to principal', () => {
    expect(applyPrincipalPayment(50000, 7500)).toEqual({
      amount: 7500,
      interestPortion: 0,
      principalPortion: 7500,
      resultingBalance: 42500,
    });
  });

  it('projects payoff and flags too-low EMI values', () => {
    expect(projectedPayoffMonths(100000, 12, 8884.88)).toBe(12);
    expect(emiWarning(100000, 12, 12, 7000)).toContain('below');
  });
});
