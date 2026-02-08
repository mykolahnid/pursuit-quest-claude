const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeCorrelation } = require('./correlation.js');

// Helper: build responses from parallel arrays
function mkData(q1s, q2s) {
  return q1s.map((v, i) => ({ q1_answer: v, q2_answer: q2s[i] }));
}

// ---------------------------------------------------------------------------
// Edge cases / guard rails
// ---------------------------------------------------------------------------
describe('analyzeCorrelation edge cases', () => {
  it('returns null for n < 3', () => {
    const r = analyzeCorrelation([{ q1_answer: 1, q2_answer: 2 }]);
    assert.equal(r.r, null);
    assert.equal(r.pValue, null);
    assert.equal(r.regression, null);
    assert.equal(r.n, 1);
  });

  it('returns null for n = 0', () => {
    const r = analyzeCorrelation([]);
    assert.equal(r.r, null);
    assert.equal(r.n, 0);
  });

  it('handles n = 3 (minimum)', () => {
    const r = analyzeCorrelation(mkData([1, 2, 3], [10, 20, 30]));
    assert.equal(r.n, 3);
    assert.equal(typeof r.r, 'number');
    assert.equal(typeof r.pValue, 'number');
  });

  it('handles constant X (zero variance)', () => {
    const r = analyzeCorrelation(mkData([5, 5, 5, 5], [1, 2, 3, 4]));
    assert.equal(r.r, 0);
  });

  it('handles constant Y (zero variance)', () => {
    const r = analyzeCorrelation(mkData([1, 2, 3, 4], [5, 5, 5, 5]));
    assert.equal(r.r, 0);
  });
});

// ---------------------------------------------------------------------------
// Pearson r correctness
// ---------------------------------------------------------------------------
describe('Pearson r', () => {
  it('perfect positive correlation → r = 1', () => {
    const r = analyzeCorrelation(mkData([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]));
    assert.equal(r.r, 1);
  });

  it('perfect negative correlation → r = -1', () => {
    const r = analyzeCorrelation(mkData([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]));
    assert.equal(r.r, -1);
  });

  it('uncorrelated data → r near 0', () => {
    // Symmetric pattern that cancels out
    const r = analyzeCorrelation(mkData([1, 2, 3, 4, 5], [3, 1, 5, 1, 3]));
    assert.ok(Math.abs(r.r) < 0.3, `expected |r| < 0.3, got ${r.r}`);
  });

  it('known hand-calculated r', () => {
    // X = [1,2,3], Y = [2,3,8]
    // meanX = 2, meanY = 4.333
    // Sxy = (1-2)(2-4.333)+(2-2)(3-4.333)+(3-2)(8-4.333) = 2.333+0+3.667 = 6
    // Sxx = 1+0+1 = 2, Syy = 5.444+1.778+13.444 = 20.667
    // r = 6 / sqrt(2 * 20.667) = 6 / 6.4291 ≈ 0.9332
    const r = analyzeCorrelation(mkData([1, 2, 3], [2, 3, 8]));
    assert.ok(Math.abs(r.r - 0.9332) < 0.001, `expected r ≈ 0.9332, got ${r.r}`);
  });
});

// ---------------------------------------------------------------------------
// p-value validity
// ---------------------------------------------------------------------------
describe('p-value bounds', () => {
  it('p is always in [0, 1]', () => {
    const datasets = [
      mkData([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]),         // r = 1
      mkData([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]),          // r = -1
      mkData([1, 2, 3, 4], [5, 5, 5, 5]),                  // r = 0
      mkData([10, 20, 30, 40, 50], [12, 18, 35, 38, 55]),  // moderate
      mkData(                                                // n = 50
        Array.from({ length: 50 }, (_, i) => i),
        Array.from({ length: 50 }, (_, i) => i * 0.5 + (i % 3) * 5),
      ),
    ];
    for (const data of datasets) {
      const r = analyzeCorrelation(data);
      assert.ok(r.pValue >= 0 && r.pValue <= 1,
        `p = ${r.pValue} out of [0,1] for r = ${r.r}, n = ${r.n}`);
    }
  });

  it('perfect correlation → p = 0', () => {
    const r = analyzeCorrelation(mkData([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]));
    assert.equal(r.pValue, 0);
  });

  it('zero correlation → p = 1', () => {
    const r = analyzeCorrelation(mkData([1, 2, 3, 4], [5, 5, 5, 5]));
    assert.equal(r.pValue, 1);
  });
});

// ---------------------------------------------------------------------------
// p-value accuracy against known t-distribution values
// ---------------------------------------------------------------------------
describe('p-value accuracy', () => {
  // Reference: two-tailed critical t-values at p = 0.05
  // df=10 → t = 2.228, df=20 → t = 2.086, df=30 → t = 2.042
  // We verify p is close to 0.05 for these t-values by constructing
  // data that yields the right t-statistic.

  // Helper: given target r and n, build linearly correlated data
  // with exactly that Pearson r (using a rank-based trick)
  function dataForR(targetR, n) {
    // X = 1..n, Y = targetR * X + sqrt(1 - r²) * orthogonal component
    // Simple approach: X = ranks, Y = r*X + noise scaled to get target r
    // Actually, for exact r, use: Y = r*X_std + sqrt(1-r²)*Z where Z ⊥ X
    const X = Array.from({ length: n }, (_, i) => i + 1);
    const meanX = (n + 1) / 2;
    const Xc = X.map((x) => x - meanX); // centered
    // Z orthogonal to X: alternating ±1 adjusted to be zero-mean & ⊥ X
    const Z = Xc.map((_, i) => (i % 2 === 0 ? 1 : -1));
    // Remove any X component from Z
    const dotZX = Z.reduce((s, z, i) => s + z * Xc[i], 0);
    const dotXX = Xc.reduce((s, x) => s + x * x, 0);
    const Zorth = Z.map((z, i) => z - (dotZX / dotXX) * Xc[i]);
    // Normalise
    const normZ = Math.sqrt(Zorth.reduce((s, z) => s + z * z, 0));
    const normX = Math.sqrt(dotXX);
    const Y = Xc.map((x, i) =>
      targetR * (x / normX) + Math.sqrt(1 - targetR * targetR) * (Zorth[i] / normZ),
    );
    return mkData(X, Y);
  }

  it('r ≈ 0.47, n = 31 → p ≈ 0.0076 (the reported bug case)', () => {
    const data = dataForR(0.47, 31);
    const res = analyzeCorrelation(data);
    // Verify r is close to target
    assert.ok(Math.abs(res.r - 0.47) < 0.01, `r = ${res.r}, expected ≈ 0.47`);
    // Expected: t ≈ 2.87, p ≈ 0.0076
    assert.ok(res.pValue > 0.003 && res.pValue < 0.015,
      `p = ${res.pValue}, expected ≈ 0.008`);
    assert.ok(res.pValue < 0.05, 'should be significant at 0.05 level');
  });

  it('r ≈ 0.35, n = 20 → p ≈ 0.13 (not significant)', () => {
    const data = dataForR(0.35, 20);
    const res = analyzeCorrelation(data);
    assert.ok(Math.abs(res.r - 0.35) < 0.01, `r = ${res.r}`);
    // t = 0.35 * sqrt(18) / sqrt(1 - 0.1225) = 1.485 / 0.937 ≈ 1.586
    // p ≈ 0.13
    assert.ok(res.pValue > 0.08 && res.pValue < 0.20,
      `p = ${res.pValue}, expected ≈ 0.13`);
    assert.ok(res.pValue >= 0.05, 'should NOT be significant at 0.05 level');
  });

  it('r ≈ 0.70, n = 15 → p ≈ 0.004 (significant)', () => {
    const data = dataForR(0.70, 15);
    const res = analyzeCorrelation(data);
    assert.ok(Math.abs(res.r - 0.70) < 0.01, `r = ${res.r}`);
    // t = 0.70 * sqrt(13) / sqrt(0.51) = 2.524 / 0.714 ≈ 3.534
    // p ≈ 0.004
    assert.ok(res.pValue > 0.001 && res.pValue < 0.01,
      `p = ${res.pValue}, expected ≈ 0.004`);
  });

  it('large n with moderate r gives very small p', () => {
    const data = dataForR(0.30, 100);
    const res = analyzeCorrelation(data);
    assert.ok(Math.abs(res.r - 0.30) < 0.01, `r = ${res.r}`);
    // t = 0.30 * sqrt(98) / sqrt(0.91) ≈ 3.11, p ≈ 0.002
    assert.ok(res.pValue < 0.01, `p = ${res.pValue}, expected < 0.01`);
  });

  it('negative correlation has same p magnitude as positive', () => {
    const posData = dataForR(0.50, 25);
    const negData = dataForR(-0.50, 25);
    const posR = analyzeCorrelation(posData);
    const negR = analyzeCorrelation(negData);
    assert.ok(Math.abs(posR.pValue - negR.pValue) < 0.001,
      `pos p = ${posR.pValue}, neg p = ${negR.pValue}`);
  });
});

// ---------------------------------------------------------------------------
// p-value must never be astronomically wrong (regression guard)
// ---------------------------------------------------------------------------
describe('p-value regression (no astronomically wrong values)', () => {
  it('p < 1 for any correlated data with n ≥ 3', () => {
    // Sweep a range of r values and sample sizes
    for (const n of [5, 10, 20, 31, 50, 100]) {
      for (const r of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const X = Array.from({ length: n }, (_, i) => i + 1);
        const Y = X.map((x) => r * x + (1 - r) * Math.sin(x));
        const data = mkData(X, Y);
        const res = analyzeCorrelation(data);
        assert.ok(res.pValue >= 0 && res.pValue <= 1,
          `INVALID p = ${res.pValue} for n=${n}, target_r=${r}, actual_r=${res.r}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------------------
describe('linear regression', () => {
  it('perfect linear relationship: Y = 2X + 3', () => {
    const data = mkData([1, 2, 3, 4, 5], [5, 7, 9, 11, 13]);
    const res = analyzeCorrelation(data);
    assert.equal(res.regression.slope, 2);
    assert.equal(res.regression.intercept, 3);
  });

  it('regression line endpoints are consistent', () => {
    const data = mkData([10, 20, 30, 40, 50], [15, 25, 28, 40, 48]);
    const res = analyzeCorrelation(data);
    const { slope, intercept, xMin, xMax, yAtXMin, yAtXMax } = res.regression;
    assert.equal(xMin, 10);
    assert.equal(xMax, 50);
    assert.ok(Math.abs(yAtXMin - (slope * xMin + intercept)) < 0.01);
    assert.ok(Math.abs(yAtXMax - (slope * xMax + intercept)) < 0.01);
  });
});

// ---------------------------------------------------------------------------
// Interpretation text
// ---------------------------------------------------------------------------
describe('interpretation', () => {
  it('strong positive + significant', () => {
    const data = mkData([1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [2, 4, 5, 8, 9, 12, 14, 15, 18, 20]);
    const res = analyzeCorrelation(data);
    assert.ok(res.interpretation.includes('strong'));
    assert.ok(res.interpretation.includes('positive'));
    assert.ok(res.interpretation.includes('IS statistically significant'));
  });

  it('negligible + not significant', () => {
    const data = mkData([1, 2, 3, 4, 5, 6], [3, 1, 4, 2, 5, 3]);
    const res = analyzeCorrelation(data);
    if (Math.abs(res.r) < 0.2) {
      assert.ok(res.interpretation.includes('negligible'));
    }
    if (res.pValue >= 0.05) {
      assert.ok(res.interpretation.includes('NOT statistically significant'));
    }
  });

  it('includes actual answer (54) and means', () => {
    const data = mkData([10, 50, 90], [20, 54, 80]);
    const res = analyzeCorrelation(data);
    assert.ok(res.interpretation.includes('54'));
    assert.ok(res.interpretation.includes('Mean Q1'));
    assert.ok(res.interpretation.includes('Mean Q2'));
  });
});
