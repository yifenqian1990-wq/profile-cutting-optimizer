let M = 20;
let smallest = 200;
let lens = [
  200, 210, 220, 230, 240, 250, 260, 270, 280, 290,
  300, 310, 320, 330, 340, 350, 360, 370, 380, 390
];
let count = 0;
function enumPatterns(capacity) {
  function search(idx, currentSum) {
    if (idx === M) {
      if (capacity - currentSum < smallest && capacity - currentSum >= 0) {
        count++;
      }
      return;
    }
    let maxCount = Math.floor((capacity - currentSum) / lens[idx]);
    for (let c = maxCount; c >= 0; c--) {
      if (count > 50000) return;
      search(idx + 1, currentSum + c * lens[idx]);
    }
  }
  search(0, 0);
  return count;
}
console.log("patterns:", enumPatterns(6000));
