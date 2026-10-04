const M = 8;
const effCap = 57050; // 5700 + 5 
const kerf = 50;
let items = [
    {i: 0, w: 18523+kerf, v: 0.3},
    {i: 1, w: 14599+kerf, v: 0.25},
    {i: 2, w: 14101+kerf, v: 0.24},
    {i: 3, w: 13676+kerf, v: 0.23},
    {i: 4, w: 12546+kerf, v: 0.21},
    {i: 5, w: 12455+kerf, v: 0.2},
    {i: 6, w: 12321+kerf, v: 0.19},
    {i: 7, w: 12227+kerf, v: 0.18}
];
let bestVal = -1;
let bestCounts = new Array(M).fill(0);
items.sort((a, b) => b.v / b.w - a.v / a.w);
function search(itemIdx, currentWeight, currentVal, counts) {
  if (itemIdx === items.length) {
    if (currentVal > bestVal) {
      bestVal = currentVal;
      bestCounts = [...counts];
    }
    return;
  }
  const item = items[itemIdx];
  const maxCount = Math.floor((effCap - currentWeight) / item.w);
  let bound = currentVal;
  let remainingW = effCap - currentWeight;
  for (let j = itemIdx; j < items.length; j++) {
    const it = items[j];
    if (it.w <= remainingW) {
      const take = Math.floor(remainingW / it.w);
      bound += take * it.v;
      remainingW -= take * it.w;
    }
    if (remainingW > 0) {
      bound += (remainingW / it.w) * it.v;
      remainingW = 0;
      break;
    }
  }
  if (bound <= bestVal + 1e-6) return;
  for (let count = maxCount; count >= 0; count--) {
    let nextCounts = counts;
    if (count > 0) {
        nextCounts = [...counts];
        nextCounts[item.i] = count;
    }
    search(itemIdx + 1, currentWeight + count * item.w, currentVal + count * item.v, nextCounts);
  }
}
search(0, 0, 0, new Array(M).fill(0));
console.log(bestVal, bestCounts);
