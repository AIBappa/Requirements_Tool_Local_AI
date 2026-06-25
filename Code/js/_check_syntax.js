const fs = require('fs');
const code = fs.readFileSync('Code/js/pipeline-stage2.js', 'utf8');
try {
  new Function(code);
  console.log('Syntax OK');
  process.exit(0);
} catch(e) {
  console.log('Syntax Error: ' + e.message);
  process.exit(1);
}