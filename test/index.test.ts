import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const testDir = path.join(__dirname, "test-files");
const testFile = path.join(testDir, "test.jsx");
const excludedFile = path.join(testDir, "excluded.tsx");
const typescriptTestFile = path.join(testDir, "typescript-test.tsx");
const emptyStylesTestFile = path.join(testDir, "empty-styles-test.jsx");
const arrayStylesTestFile = path.join(testDir, "array-styles-test.jsx");
const optionalStylesTestFile = path.join(testDir, "optional-styles-test.jsx");
const nestedStylesTestFile = path.join(testDir, "nested-styles-test.tsx");
const destructuringTestFile = path.join(testDir, "destructuring-test.tsx");
const bracketAccessTestFile = path.join(testDir, "bracket-access-test.tsx");
const multipleStylesheetsTestFile = path.join(testDir, "multiple-stylesheets-test.tsx");
const customVariableTestFile = path.join(testDir, "custom-variable-test.tsx");
const dynamicAccessTestFile = path.join(testDir, "dynamic-access-test.tsx");

beforeAll(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  fs.writeFileSync(
    testFile,
    `
    import { StyleSheet, View } from "react-native";
    export function TestComponent() {
      return <View style={styles.container}></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      unused: { flex: 2 },
    });
  `,
  );
  fs.writeFileSync(
    excludedFile,
    `
    import { StyleSheet, View } from "react-native";
    export function ExcludedComponent() {
      return <View style={styles.container}></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      unused: { flex: 2 },
    });
  `,
  );
  fs.writeFileSync(
    typescriptTestFile,
    `
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
  `,
  );
  fs.writeFileSync(
    emptyStylesTestFile,
    `
    import { StyleSheet, View } from "react-native";
    export function EmptyStylesComponent() {
      return <View></View>;
    }
    const styles = StyleSheet.create({
      unused: { flex: 2 },
    });
  `,
  );
  fs.writeFileSync(
    arrayStylesTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function TestComponent() {
      return <View style={styles.container}><Text style={[styles.textBold, styles.textLarge]}>Large Text</Text></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      textBold: { fontWeight: "bold" },
      textLarge: { fontSize: 24, lineHeight: 28 },
      unused: { flex: 2 },
    });
  `,
  );
  fs.writeFileSync(
    optionalStylesTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function TestComponent({ useBold, useLarge }) {
      return <View style={styles.container}><Text style={[useBold && styles.textBold, useLarge ? styles.textLarge : styles.textSmall]}>Large Text</Text></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      textBold: { fontWeight: "bold" },
      textSmall: { fontSize: 16, lineHeight: 20 },
      textLarge: { fontSize: 24, lineHeight: 28 },
      unused: { flex: 2 },
    });
  `,
  );
  // Test for nested objects (verifies the regex bug is fixed)
  fs.writeFileSync(
    nestedStylesTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function NestedComponent() {
      return (
        <View style={styles.container}>
          <Text style={styles.text}>Hello</Text>
        </View>
      );
    }
    const styles = StyleSheet.create({
      container: {
        flex: 1,
        padding: 10,
        margin: {
          top: 5,
          bottom: 5,
        },
      },
      text: {
        color: 'blue',
        fontWeight: 'bold',
      },
      unused: {
        flex: 2,
        nested: {
          value: 1,
        },
      },
    });
  `,
  );
  // Test for destructuring
  fs.writeFileSync(
    destructuringTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function DestructuringComponent() {
      const { container, text } = styles;
      return (
        <View style={container}>
          <Text style={text}>Hello</Text>
        </View>
      );
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      text: { color: 'blue' },
      unused: { flex: 2 },
    });
  `,
  );
  // Test for bracket access
  fs.writeFileSync(
    bracketAccessTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function BracketAccessComponent() {
      return (
        <View style={styles['container']}>
          <Text style={styles["text"]}>Hello</Text>
        </View>
      );
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      text: { color: 'blue' },
      unused: { flex: 2 },
    });
  `,
  );
  // Test for multiple stylesheets in one file
  fs.writeFileSync(
    multipleStylesheetsTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function MultipleStylesheetsComponent() {
      return (
        <View style={containerStyles.wrapper}>
          <Text style={textStyles.heading}>Hello</Text>
        </View>
      );
    }
    const containerStyles = StyleSheet.create({
      wrapper: { flex: 1 },
      unusedContainer: { padding: 10 },
    });
    const textStyles = StyleSheet.create({
      heading: { fontSize: 24 },
      unusedText: { color: 'red' },
    });
  `,
  );
  // Test for custom variable names
  fs.writeFileSync(
    customVariableTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function CustomVariableComponent() {
      return (
        <View style={myStyles.container}>
          <Text style={myStyles.text}>Hello</Text>
        </View>
      );
    }
    const myStyles = StyleSheet.create({
      container: { flex: 1 },
      text: { color: 'blue' },
      unused: { flex: 2 },
    });
  `,
  );
  // Test for dynamic access (should preserve all styles)
  fs.writeFileSync(
    dynamicAccessTestFile,
    `
    import { StyleSheet, View, Text } from "react-native";
    export function DynamicAccessComponent({ styleKey }) {
      return (
        <View style={styles[styleKey]}>
          <Text>Hello</Text>
        </View>
      );
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      text: { color: 'blue' },
      seeminglyUnused: { flex: 2 },
    });
  `,
  );
});

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Re-create test files before each test to ensure clean state
  fs.writeFileSync(
    testFile,
    `
    import { StyleSheet, View } from "react-native";
    export function TestComponent() {
      return <View style={styles.container}></View>;
    }
    const styles = StyleSheet.create({
      container: { flex: 1 },
      unused: { flex: 2 },
    });
  `,
  );
});

test("removes unused styles with exclusion check", () => {
  execSync(`tsx src/index.ts -d ${testDir} -e **/excluded.tsx --no-format`);
  const result = fs.readFileSync(testFile, "utf-8");
  expect(result).toContain("container");
  expect(result).not.toContain("unused");

  const excludedResult = fs.readFileSync(excludedFile, "utf-8");
  expect(excludedResult).toContain("unused");
});

test("removes unused styles in TypeScript file", () => {
  execSync(`tsx src/index.ts -d ${testDir} -e **/excluded.tsx --no-format`);
  const result = fs.readFileSync(typescriptTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("text");
  expect(result).not.toContain("unused");
  expect(result).toContain("type ActivityIndicatorProps");
  expect(result).toContain("ActivityIndicator as PaperActivityIndicator");
  expect(result).toContain("type Props");
  expect(result).toContain("title: string");
});

test("handles empty styles correctly", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(emptyStylesTestFile, "utf-8");
  expect(result).toContain("StyleSheet.create({");
  expect(result).not.toContain("unused");
});

test("handles array of styles correctly", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(arrayStylesTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("textBold");
  expect(result).toContain("textLarge");
  expect(result).not.toContain("unused");
});

test("handles optional styles correctly", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(optionalStylesTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("textBold");
  expect(result).toContain("textSmall");
  expect(result).toContain("textLarge");
  expect(result).not.toContain("unused");
});

test("handles nested style objects correctly", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(nestedStylesTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("text");
  expect(result).toContain("padding: 10");
  expect(result).toContain("top: 5");
  expect(result).not.toContain("unused");
});

test("handles destructuring correctly", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(destructuringTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("text");
  expect(result).not.toContain("unused");
});

test("handles bracket access correctly", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(bracketAccessTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("text");
  expect(result).not.toContain("unused");
});

test("handles multiple stylesheets in one file", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(multipleStylesheetsTestFile, "utf-8");
  expect(result).toContain("wrapper");
  expect(result).toContain("heading");
  expect(result).not.toContain("unusedContainer");
  expect(result).not.toContain("unusedText");
});

test("handles custom variable names", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(customVariableTestFile, "utf-8");
  expect(result).toContain("container");
  expect(result).toContain("text");
  expect(result).not.toContain("unused");
});

test("preserves all styles when dynamic access is used", () => {
  execSync(`tsx src/index.ts -d ${testDir} --no-format`);
  const result = fs.readFileSync(dynamicAccessTestFile, "utf-8");
  // All styles should be preserved because of dynamic access
  expect(result).toContain("container");
  expect(result).toContain("text");
  expect(result).toContain("seeminglyUnused");
});
