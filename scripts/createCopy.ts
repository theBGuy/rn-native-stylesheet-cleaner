import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const sourceFile = path.join(__dirname, '..', 'example', '_clean.tsx');
const targetFile = path.join(__dirname, '..', 'example', 'cleaned.tsx');

// Copy the _clean.tsx file to cleaned.tsx
fs.copyFileSync(sourceFile, targetFile);
console.log(`Copied ${sourceFile} to ${targetFile}`);

// Run the main script on the copied file
// const mainScript = path.join(__dirname, '..', 'src', 'index.ts');
// const command = `tsx ${mainScript} -d ${path.join(__dirname, '..', 'example')} -i 'cleaned.tsx'`;
// console.log(`Running command: ${command}`);
// execSync(command, { stdio: 'inherit' });

// console.log('Cleaning completed.');