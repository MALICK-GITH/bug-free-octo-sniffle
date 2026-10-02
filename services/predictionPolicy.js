const MIN_RECOMMENDED_ODDS = 1.5;

function isPlayableOdd(value) {
  const odd = Number(value);
  return Number.isFinite(odd) && odd >= MIN_RECOMMENDED_ODDS;
}

module.exports = { MIN_RECOMMENDED_ODDS, isPlayableOdd };
