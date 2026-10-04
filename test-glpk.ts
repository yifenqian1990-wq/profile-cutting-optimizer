const glpk = require('glpk.js')(require('glpk.js').CustomPromise);
glpk.then(glp => {
    const lp = {
        name: 'test', objective: { direction: glp.GLP_MAX, name: 'obj', vars: [] },
        subjectTo: [], generals: []
    };
    for(let i=0; i<500; i++) {
        lp.objective.vars.push({ name: `x${i}`, coef: Math.random() });
        lp.generals.push(`x${i}`);
    }
    // Very hard knapsack
    let vars = [];
    for(let i=0; i<500; i++) vars.push({ name: `x${i}`, coef: Math.random() });
    lp.subjectTo.push({ name: 'c1', vars, bnds: { type: glp.GLP_UP, lb: 0, ub: 250 } });
    
    // Attempt with tm_lim = 1s?
    console.log("Solving...");
    const res = glp.solve(lp, { msglev: glp.GLP_MSG_OFF, cb: { msg_lev: 0, tm_lim: 1000 } });
    console.log(res);
});
