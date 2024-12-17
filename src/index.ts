import fs from 'node:fs';
import path from 'node:path';
import { transformFromAstSync} from '@babel/core';
import traverse from "@babel/traverse"
import { parse} from '@babel/parser';
import { Command } from 'commander';
import { minimatch } from 'minimatch';
import * as t from "@babel/types";

const program = new Command();

program
  .option('-d, --directory <path>', 'directory to parse', 'src')
  .option('-i, --include <patterns>', 'file patterns to include', '**/*.{jsx,tsx}')
  .option('-e, --exclude <patterns>', 'file patterns to exclude', '')
  .parse(process.argv);

const options = program.opts();
const directoryPath = path.isAbsolute(options.directory) ? options.directory : path.resolve(process.cwd(), options.directory);
const includePatterns: string = options.include;
const excludePatterns: string = options.exclude;
console.log(includePatterns, excludePatterns)

const parseFile = (filePath: string) => {
  const code = fs.readFileSync(filePath, "utf-8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const usedStyles = new Set();
  const styleSheetName = "styles";

  traverse(ast, {
    MemberExpression(path) {
      if (
        path.node.object &&
        ("name" in path.node.object) &&
        path.node.object.name === styleSheetName &&
        path.node.property &&
        ("name" in path.node.property) &&
        path.node.property.name
      ) {
        usedStyles.add(path.node.property.name);
      }
    },
  });

  traverse(ast, {
    VariableDeclarator(path) {
      const { node } = path;

      if (
        t.isIdentifier(node.id, { name: styleSheetName }) &&
        t.isCallExpression(node.init) &&
        t.isMemberExpression(node.init.callee) &&
        t.isIdentifier(node.init.callee.object, { name: "StyleSheet" }) &&
        t.isIdentifier(node.init.callee.property, { name: "create" })
      ) {
        const styleObject = node.init.arguments[0];
        if (t.isObjectExpression(styleObject)) {
          styleObject.properties = styleObject.properties.filter((property) => {
            const keep =
              t.isObjectProperty(property) &&
              t.isIdentifier(property.key) &&
              usedStyles.has(property.key.name);
            console.log(
              // @ts-ignore
              `Property ${property.key.name} is ${keep ? "kept" : "removed"}`
            );
            return keep;
          });
        }
      }
    },
  });

  const result = transformFromAstSync(ast, code, {
    filename: filePath,
    plugins: ["@babel/plugin-syntax-jsx"],
    presets: [/* "@babel/preset-react", */ "@babel/preset-typescript"],
    generatorOpts: { compact: false, retainLines: true, comments: true },
  });

  if (result?.code) {
    fs.writeFileSync(filePath, result.code, "utf-8");
    console.log(`Updated file: ${filePath}`);
  }
};

const shouldIncludeFile = (filePath: string) => {
  // const shouldInclude = includePatterns.some(pattern => minimatch(filePath, pattern)) || !includePatterns.length;
  // const shouldExclude = excludePatterns.some(pattern => minimatch(filePath, pattern));
  const shouldInclude = minimatch(filePath, includePatterns);
  const shouldExclude = minimatch(filePath, excludePatterns);
  console.log(filePath, shouldInclude, shouldExclude);
  return shouldInclude && !shouldExclude;
};

const parseDirectory = (dirPath: string) => {
  const files = fs.readdirSync(dirPath);
  console.log(dirPath, files.length);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      parseDirectory(filePath);
    } else if (shouldIncludeFile(filePath)) {
      parseFile(filePath);
    }
  }
};

parseDirectory(directoryPath);