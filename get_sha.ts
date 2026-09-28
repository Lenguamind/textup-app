import { execSync } from 'child_process';
try {
  const output = execSync('cd android && sh ./gradlew signingReport').toString();
  console.log(output);
} catch (e: any) {
  console.log('Error:', e.message);
}
