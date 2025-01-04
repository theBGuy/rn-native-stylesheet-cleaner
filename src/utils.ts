import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const findConfigFile = (dir: string, filenames: string[]) => {
  for (const filename of filenames) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

export const detectFormatter = (directory: string) => {
  const prettierConfigs = [".prettierrc", ".prettierrc.js", ".prettierrc.json", "prettier.config.js"];
  const biomeConfigs = ["biome.json", "biome.jsonc", "biome.config.json"];

  const prettierConfigPath = findConfigFile(directory, prettierConfigs);
  if (prettierConfigPath) return "prettier";

  const biomeConfigPath = findConfigFile(directory, biomeConfigs);
  if (biomeConfigPath) return "biome";

  return null;
};

const formatWithBiome = (filePath: string) => {
  execSync(`npx biome format --write ${filePath}`, { stdio: "inherit" });
};

export const formatFile = (filePath: string, formatter: string | null) => {
  try {
    if (formatter === "prettier") {
      const prettier = require("prettier");
      const prettierConfig = prettier.resolveConfig.sync(filePath) || {};
      prettierConfig.parser = filePath.endsWith(".tsx") ? "tsx" : "babel";
      const code = fs.readFileSync(filePath, "utf-8");
      const formattedCode = prettier.format(code, prettierConfig);
      fs.writeFileSync(filePath, formattedCode, "utf-8");
    } else if (formatter === "biome") {
      formatWithBiome(filePath);
    }
  } catch (err) {
    console.error(err);
  }
};
