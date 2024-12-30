import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const testDir = path.join(__dirname, 'test-files');
const testFile = path.join(testDir, 'test.jsx');
const excludedFile = path.join(testDir, 'excluded.tsx');
const typescriptTestFile = path.join(testDir, 'typescript-test.tsx');

beforeAll(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  fs.writeFileSync(testFile, `
    import { StyleSheet, View } from "react-native";
    export function TestComponent() {
      return <View style={styles.container}></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      unused: { flex: 2 },
    });
  `);
  fs.writeFileSync(excludedFile, `
    import { StyleSheet, View } from "react-native";
    export function ExcludedComponent() {
      return <View style={styles.container}></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      unused: { flex: 2 },
    });
  `);
  fs.writeFileSync(typescriptTestFile, `
    import { StyleSheet, View, Text } from "react-native";
    import { type ActivityIndicatorProps, ActivityIndicator as PaperActivityIndicator } from "react-native-paper";
    type Props = {
      title: string;
    };
    export function TypeScriptComponent({ title }: Props) {
      return (
        <View style={styles.container}>
          <Text style={styles.text}>{title}</Text>
        </View>
      );
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      text: { color: 'blue' },
      unused: { flex: 2 },
    });
  `);
});

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('removes unused styles with exclusion check', () => {
  execSync(`tsx src/index.ts -d ${testDir} -e **/excluded.tsx`);
  const result = fs.readFileSync(testFile, 'utf-8');
  expect(result).toContain('container');
  expect(result).not.toContain('unused');

  const excludedResult = fs.readFileSync(excludedFile, 'utf-8');
  expect(excludedResult).toContain('unused');
});

test('removes unused styles in TypeScript file', () => {
  execSync(`tsx src/index.ts -d ${testDir} -e **/excluded.tsx`);
  const result = fs.readFileSync(typescriptTestFile, 'utf-8');
  expect(result).toContain('container');
  expect(result).toContain('text');
  expect(result).not.toContain('unused');
  expect(result).toContain('type ActivityIndicatorProps');
  expect(result).toContain('ActivityIndicator as PaperActivityIndicator');
  expect(result).toContain('type Props');
  expect(result).toContain('title: string');
});