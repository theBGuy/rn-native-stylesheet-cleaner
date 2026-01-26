import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Minimal type definition for prettier (optional dependency)
interface PrettierModule {
  resolveConfig(filePath: string): Promise<Record<string, unknown> | null>;
  format(source: string, options?: Record<string, unknown>): Promise<string>;
}

const findConfigFile = (dir: string, filenames: string[]) => {
  for (const filename of filenames) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

const hasPrettierInPackageJson = (dir: string): boolean => {
  const packageJsonPath = path.join(dir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      return "prettier" in packageJson;
    } catch {
      return false;
    }
  }
  return false;
};

export const detectFormatter = (directory: string) => {
  const prettierConfigs = [
    ".prettierrc",
    ".prettierrc.js",
    ".prettierrc.cjs",
    ".prettierrc.mjs",
    ".prettierrc.json",
    ".prettierrc.json5",
    ".prettierrc.yaml",
    ".prettierrc.yml",
    ".prettierrc.toml",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs",
  ];
  const biomeConfigs = ["biome.json", "biome.jsonc", "biome.config.json"];

  const prettierConfigPath = findConfigFile(directory, prettierConfigs);
  if (prettierConfigPath || hasPrettierInPackageJson(directory)) return "prettier";

  const biomeConfigPath = findConfigFile(directory, biomeConfigs);
  if (biomeConfigPath) return "biome";

  return null;
};

const formatWithBiome = (filePath: string) => {
  execSync(`npx biome format --write ${filePath}`, { stdio: "inherit" });
};

const formatWithPrettier = async (filePath: string): Promise<void> => {
  // Use dynamic require for prettier (optional dependency)
  // biome-ignore lint/security/noGlobalEval: needed for dynamic require in strict mode
  const loadModule = eval("require") as NodeRequire;
  const prettier = loadModule("prettier") as PrettierModule;

  const prettierConfig = (await prettier.resolveConfig(filePath)) || {};
  const parser = filePath.endsWith(".tsx") ? "typescript" : filePath.endsWith(".jsx") ? "babel" : "typescript";
  const code = fs.readFileSync(filePath, "utf-8");
  const formattedCode = await prettier.format(code, { ...prettierConfig, parser });
  fs.writeFileSync(filePath, formattedCode, "utf-8");
};

export const formatFile = async (filePath: string, formatter: string | null): Promise<void> => {
  try {
    if (formatter === "prettier") {
      await formatWithPrettier(filePath);
    } else if (formatter === "biome") {
      formatWithBiome(filePath);
    }
  } catch (err) {
    console.error(`Error formatting file ${filePath}:`, err);
  }
};
