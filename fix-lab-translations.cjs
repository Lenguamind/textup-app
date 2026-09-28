const fs = require('fs');

function replaceLineExact(path, lineNum, oldStr, newStr) {
  const lines = fs.readFileSync(path, 'utf8').split('\n');
  const idx = lineNum - 1;
  if (!lines[idx].includes(oldStr)) {
    throw new Error(`MISMATCH at ${path}:${lineNum} — expected "${oldStr}" but found: ${lines[idx]}`);
  }
  lines[idx] = lines[idx].replace(oldStr, newStr);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
}

// 1. Renombrar el primer bloc (bàsic) a ca.ts
replaceLineExact('translations/ca.ts', 146, 'analysisSteps: {', 'analysisStepsBasic: {');
replaceLineExact('translations/ca.ts', 152, 'analysisLabels: {', 'analysisLabelsBasic: {');
replaceLineExact('translations/ca.ts', 155, 'stepDescriptions: {', 'stepDescriptionsBasic: {');
console.log('ca.ts actualitzat');

// 2. Renombrar el primer bloc (bàsic) a es.ts
replaceLineExact('translations/es.ts', 142, 'analysisSteps: {', 'analysisStepsBasic: {');
replaceLineExact('translations/es.ts', 148, 'analysisLabels: {', 'analysisLabelsBasic: {');
replaceLineExact('translations/es.ts', 151, 'stepDescriptions: {', 'stepDescriptionsBasic: {');
console.log('es.ts actualitzat');

// 3. Afegir el bloc bàsic (en anglès) a en.ts, abans del bloc existent
const enPath = 'translations/en.ts';
let enLines = fs.readFileSync(enPath, 'utf8').split('\n');
const targetIdx = enLines.findIndex((l, i) => i >= 160 && l.includes('analysisSteps: {'));
if (targetIdx === -1) throw new Error('No he trobat analysisSteps a en.ts on esperava');

const basicBlock = [
  '    analysisStepsBasic: {',
  '      digitalization: "Smart digitalization",',
  '      context: "Context adaptation",',
  '      vocab: "Advanced vocabulary",',
  '      structure: "Perfect structure"',
  '    },',
  '    analysisLabelsBasic: {',
  '      orWrite: "Or write your text"',
  '    },',
  '    stepDescriptionsBasic: {',
  '      ocr1: "Handwritten text recognition (advanced OCR)",',
  '      ocr2: "Identification of incomplete or unclear sentences",',
  '      ocr3: "Automatic correction of possible reading errors",',
  '      context1: "Detects text type: narrative, formal...",',
  '      context2: "Suggestions for more appropriate words",',
  '      context3: "Register adjustment (formal <-> colloquial)",',
  '      vocab1: "Removal of unnecessary repetitions",',
  '      vocab2: "Replacement with more precise synonyms",',
  '      vocab3: "Enrichment of vocabulary and expressiveness",',
  '      structure1: "Logical ordering of ideas and paragraphs",',
  '      structure2: "Use of connectors to link sentences",',
  '      structure3: "Improved punctuation and rhythm"',
  '    },'
];

enLines.splice(targetIdx, 0, ...basicBlock);
fs.writeFileSync(enPath, enLines.join('\n'), 'utf8');
console.log('en.ts actualitzat (bloc bàsic afegit)');

// 4. Actualitzar LinguisticLab.tsx — només les línies del bloc bàsic
const tsxPath = 'pages/LinguisticLab.tsx';
const linesToFix = [358,411,440,443,444,445,451,455,457,458,464,467,468,469,475,478,479,480];
let tsxLines = fs.readFileSync(tsxPath, 'utf8').split('\n');

linesToFix.forEach(lineNum => {
  const idx = lineNum - 1;
  const before = tsxLines[idx];
  let line = before;
  line = line.replace('lab.analysisSteps.', 'lab.analysisStepsBasic.');
  line = line.replace('lab.analysisLabels.', 'lab.analysisLabelsBasic.');
  line = line.replace('lab.stepDescriptions.', 'lab.stepDescriptionsBasic.');
  tsxLines[idx] = line;
  if (before === line) {
    console.warn(`AVÍS: línia ${lineNum} no ha canviat, revisa-la manualment: ${before.trim()}`);
  }
});

fs.writeFileSync(tsxPath, tsxLines.join('\n'), 'utf8');
console.log('LinguisticLab.tsx actualitzat');

console.log('\nFET. Ara verifica amb els grep de comprovació.');
