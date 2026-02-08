/**
 * Generate realistic test data that simulates the anchoring/priming effect.
 *
 * Q1 is uniform random 1-100. Q2 is influenced by Q1 (anchoring bias)
 * plus noise centered around the true answer (54 African UN members).
 */

export function generateTestData(count = 30, { mode = 'correlated', anchorStrength = 0.4 } = {}) {
  const responses = [];

  for (let i = 0; i < count; i++) {
    const q1 = Math.floor(Math.random() * 100) + 1;

    let q2;
    if (mode === 'random') {
      // No anchoring effect — Q2 is independent of Q1
      q2 = Math.round(gaussianRandom(54, 20));
    } else {
      // Correlated — Q1 anchors Q2
      const baseEstimate = gaussianRandom(54, 20);
      const anchoredEstimate =
        anchorStrength * q1 + (1 - anchorStrength) * baseEstimate;
      const noise = gaussianRandom(0, 8);
      q2 = Math.round(anchoredEstimate + noise);
    }
    q2 = Math.max(0, Math.min(100, q2));

    responses.push({ q1, q2 });
  }

  return responses;
}

function gaussianRandom(mean = 0, stddev = 1) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const normal =
    Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + normal * stddev;
}
