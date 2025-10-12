import { execSync } from 'child_process';
import inquirer from 'inquirer';

async function bumpVersion() {
  const { type }: { type: 'patch' | 'minor' | 'major' } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'What type of version bump is this?',
      choices: [
        { name: 'Patch (bug fixes)', value: 'patch' },
        { name: 'Minor (new features)', value: 'minor' },
        { name: 'Major (breaking changes)', value: 'major' },
      ],
    },
  ]);

  try {
    execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'inherit' });
    console.log(`✅ Version bumped: ${type}`);
  } catch (err) {
    console.error('❌ Version bump failed:', err);
    process.exit(1);
  }
}

bumpVersion();
