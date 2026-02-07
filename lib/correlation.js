/**
 * Pearson correlation analysis with p-value via t-test.
 * All math implemented from scratch - no external stats library needed.
 */

export function analyzeCorrelation(responses) {
  const n = responses.length;
  if (n < 3) {
    return {
      r: null,
      pValue: null,
      n,
      interpretation: 'Need at least 3 data points for correlation analysis.',
      regression: null,
    };
  }

  const X = responses.map((r) => r.q1_answer);
  const Y = responses.map((r) => r.q2_answer);

  const sumX = X.reduce((a, b) => a + b, 0);
  const sumY = Y.reduce((a, b) => a + b, 0);
  const sumXY = X.reduce((acc, xi, i) => acc + xi * Y[i], 0);
  const sumX2 = X.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = Y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  const r = denominator === 0 ? 0 : numerator / denominator;

  // t-test for significance
  const df = n - 2;
  const rSquared = r * r;
  const tStat =
    rSquared >= 1 ? Infinity : r * Math.sqrt(df) / Math.sqrt(1 - rSquared);
  const pValue =
    Math.abs(tStat) === Infinity ? 0 : tDistributionPValue(Math.abs(tStat), df) * 2;

  // Linear regression
  const meanX = sumX / n;
  const meanY = sumY / n;
  const slopeNumerator = n * sumXY - sumX * sumY;
  const slopeDenominator = n * sumX2 - sumX * sumX;
  const slope = slopeDenominator === 0 ? 0 : slopeNumerator / slopeDenominator;
  const intercept = meanY - slope * meanX;
  const xMin = Math.min(...X);
  const xMax = Math.max(...X);

  // Interpretation
  const absR = Math.abs(r);
  let strength;
  if (absR >= 0.7) strength = 'strong';
  else if (absR >= 0.4) strength = 'moderate';
  else if (absR >= 0.2) strength = 'weak';
  else strength = 'negligible';

  const direction = r >= 0 ? 'positive' : 'negative';
  const significant = pValue < 0.05;

  let interpretation = `There is a ${strength} ${direction} correlation (r = ${r.toFixed(4)}) between the anchor number (Q1) and the estimate of African UN members (Q2). `;

  if (significant) {
    interpretation += `This correlation IS statistically significant (p = ${pValue.toFixed(6)}, p < 0.05), supporting the anchoring effect hypothesis. `;
  } else {
    interpretation += `This correlation is NOT statistically significant (p = ${pValue.toFixed(6)}, p >= 0.05). More data may be needed. `;
  }

  interpretation += `The actual answer is 54 African UN member states. Mean Q1 (anchor): ${meanX.toFixed(1)}, Mean Q2 (estimate): ${meanY.toFixed(1)}.`;

  return {
    r: parseFloat(r.toFixed(6)),
    pValue: parseFloat(pValue.toFixed(8)),
    tStatistic: parseFloat(tStat.toFixed(4)),
    degreesOfFreedom: df,
    n,
    meanQ1: parseFloat(meanX.toFixed(2)),
    meanQ2: parseFloat(meanY.toFixed(2)),
    interpretation,
    regression: {
      slope: parseFloat(slope.toFixed(4)),
      intercept: parseFloat(intercept.toFixed(4)),
      xMin,
      xMax,
      yAtXMin: parseFloat((slope * xMin + intercept).toFixed(2)),
      yAtXMax: parseFloat((slope * xMax + intercept).toFixed(2)),
      r: parseFloat(r.toFixed(4)),
    },
  };
}

function tDistributionPValue(t, df) {
  const x = df / (df + t * t);
  return regularizedIncompleteBeta(x, df / 2, 0.5);
}

function regularizedIncompleteBeta(x, a, b) {
  if (x === 0 || x === 1) return x;

  const lnBetaVal = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const prefix = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBetaVal);

  if (x < (a + 1) / (a + b + 2)) {
    return (prefix * betaContinuedFraction(x, a, b)) / a;
  } else {
    return 1 - regularizedIncompleteBeta(1 - x, b, a);
  }
}

function betaContinuedFraction(x, a, b) {
  const maxIterations = 200;
  const epsilon = 1e-10;

  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;
  let result = d;

  for (let i = 1; i <= maxIterations; i++) {
    let numerator =
      (i * (b - i) * x) / ((a + 2 * i - 1) * (a + 2 * i));
    d = 1 + numerator * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    let c = 1 + numerator / (result === 0 ? epsilon : 1);
    if (Math.abs(c) < epsilon) c = epsilon;
    result *= d * c;

    numerator =
      (-(a + i) * (a + b + i) * x) / ((a + 2 * i) * (a + 2 * i + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    c = 1 + numerator / (result === 0 ? epsilon : 1);
    if (Math.abs(c) < epsilon) c = epsilon;
    result *= d * c;

    if (Math.abs(d * c - 1) < epsilon) break;
  }
  return result;
}

function lnGamma(z) {
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < 9; i++) {
    x += coef[i] / (z + i);
  }
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
