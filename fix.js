import fs from 'fs';
let content = fs.readFileSync('src/components/ResultsView.tsx', 'utf8');

const startIndex = content.indexOf('  const effectiveSummary = React.useMemo(() => {');
if (startIndex !== -1) {
    const endIndexStr = 'return newSummary;\n  }, [summary, salesData, columns, planName]);\n';
    const endIndex = content.indexOf(endIndexStr, startIndex);
    if (endIndex !== -1) {
        const afterIndex = endIndex + endIndexStr.length;
        content = content.substring(0, startIndex) + content.substring(afterIndex);
    }
}

content = content.replace(/effectiveSummary/g, 'summary');
fs.writeFileSync('src/components/ResultsView.tsx', content, 'utf8');
