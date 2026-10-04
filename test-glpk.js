import GLPK from 'glpk.js';
GLPK().then(glp => {
    const lp = {
        name: 'test', objective: { direction: glp.GLP_MAX, name: 'obj', vars: [] },
        subjectTo: [], generals: []
    };
    for(let i=0; i<50; i++) {
        lp.objective.vars.push({ name: `x${i}`, coef: Math.random() });
        lp.generals.push(`x${i}`);
        lp.subjectTo.push({ name: `c_${i}`, vars: [{name: `x${i}`, coef: 1}], bnds: { type: glp.GLP_UP, lb: 0, ub: 100 } });
    }
    
    let vars = [];
    for(let i=0; i<50; i++) vars.push({ name: `x${i}`, coef: Math.random() });
    lp.subjectTo.push({ name: 'c1', vars, bnds: { type: glp.GLP_UP, lb: 0, ub: 25 } });
    
    console.log("Solving...");
    let start = Date.now();
    const res = glp.solve(lp, { msglev: glp.GLP_MSG_OFF, cb: { msg_lev: 0, tm_lim: 1000 } });
    console.log("Time: ", Date.now() - start, "Status:", res.result.status);
});
