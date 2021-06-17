const normalizeUrl = (str) => str.split("?")[0];

const sum = (arr) => arr.reduce((acc, n) => acc + n);

const mode = (arr) =>
  arr
    .sort(
      (a, b) =>
        arr.filter((n) => n === a).length - arr.filter((n) => n === b).length
    )
    .pop();

const percentile = (arr, q) => {
  const sorted = arr.sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return Math.round(sorted[base] + rest * (sorted[base + 1] - sorted[base]));
  } else {
    return Math.round(sorted[base]);
  }
};

module.exports = { normalizeUrl, sum, mode, percentile };
