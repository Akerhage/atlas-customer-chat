'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const mutations = [
  {
    name: 'quick action inherits textarea focus',
    file: path.join(root, 'src', 'components', 'chat', 'chat-input-focus.ts'),
    test: 'src/components/chat/ChatInput.focus.test.ts',
    mutate: source => source.replace('return source === "textarea";', 'return true;')
  },
  {
    name: 'curated quick questions are capped below storage limit',
    file: path.join(root, 'src', 'components', 'chat', 'QuickQuestionsButton.tsx'),
    test: 'src/components/chat/QuickQuestionsButton.test.ts',
    mutate: source => source.replace(
      'const tenantGeneralQuestions = tenantQuestionsAllowed.filter(question => question.scope === "general");',
      'const tenantGeneralQuestions = tenantQuestionsAllowed.filter(question => question.scope === "general").slice(0, 12);'
    )
  }
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

for (const mutation of mutations) {
  const original = fs.readFileSync(mutation.file);
  const originalHash = sha256(original);
  const mutated = Buffer.from(mutation.mutate(original.toString('utf8')), 'utf8');
  assert.notEqual(sha256(mutated), originalHash, `mutation ändrade inte: ${mutation.name}`);
  try {
    fs.writeFileSync(mutation.file, mutated);
    const result = spawnSync(npmCommand, ['test', '--', '--run', mutation.test], {
      cwd: root,
      encoding: 'utf8',
      shell: false
    });
    assert.notEqual(result.status, 0, `mutation överlevde: ${mutation.name}`);
    console.log(`PASS mutation caught: ${mutation.name}`);
  } finally {
    fs.writeFileSync(mutation.file, original);
  }
  assert.equal(sha256(fs.readFileSync(mutation.file)), originalHash, `Buffer-återställning ändrade bytes: ${mutation.name}`);
}

console.log('RESULT KAN-296 customer-chat mutations caught with byte-identical restore');
