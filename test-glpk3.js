import GLPK from 'glpk.js/node';
async function test() {
  const glpk = await GLPK();
  const lp = {
    name: 'LP',
    objective: { direction: glpk.GLP_MIN, name: 'obj', vars: [{ name: 'x1', coef: 1 }, { name: 'x2', coef: 1 }] },
    subjectTo: [
      { name: 'dem1', vars: [{ name: 'x1', coef: 2 }, { name: 'x2', coef: 1 }], bnds: { type: glpk.GLP_LO, lb: 10, ub: 0 } },
      { name: 'dem2', vars: [{ name: 'x1', coef: 1 }, { name: 'x2', coef: 2 }], bnds: { type: glpk.GLP_LO, lb: 10, ub: 0 } },
      { name: 'stock1', vars: [{ name: 'x1', coef: 1 }], bnds: { type: glpk.GLP_UP, lb: 0, ub: 2 } }
    ],
    generals: [], binaries: []
  };
  const res = await glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF });
  console.log(JSON.stringify(res));
}
test();
