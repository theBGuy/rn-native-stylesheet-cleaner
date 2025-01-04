#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { minimatch } from "minimatch";
import ts from "typescript";
import { version } from "../package.json";
import { detectFormatter, formatFile } from "./utils";

const program = new Command();

program
  .version(version, "-V, --version", "output the current version")
  .option("-d, --directory <path>", "directory to parse", "src")
  .option("-i, --include <patterns>", "file patterns to include", "**/*.{jsx,tsx}")
  .option("-e, --exclude <patterns>", "file patterns to exclude", "")
  .option("--no-format", "run without formatting the output")
  .option("--dry-run", "run without making any changes")
  .option("--verbose", "output detailed information")
  .parse(process.argv);

const options = program.opts();

if (process.argv.includes("-V") || process.argv.includes("--version")) {
  process.exit(0);
}

const directoryPath = path.isAbsolute(options.directory)
  ? options.directory
  : path.resolve(process.cwd(), options.directory);
const includePatterns: string = options.include;
const excludePatterns: string = options.exclude;
const isDryRun = options.dryRun;
const isVerbose = options.verbose;
const noFormat = options.noFormat;
const formatter = detectFormatter(process.cwd());

const log = (message?: any, ...optionalParams: any[]) => {
  if (isVerbose) {
    console.log(message, ...optionalParams);
  }
};

log(formatter ? `${formatter} detected` : "No formatter detected; skipping formatting.");

const parseFile = (filePath: string) => {
  const sourceCode = fs.readFileSync(filePath, "utf-8");
  const isTsx = filePath.endsWith(".tsx");
  const isJsx = filePath.endsWith(".jsx");

  let hasChanges = false;
  const scriptKind = isTsx ? ts.ScriptKind.TSX : isJsx ? ts.ScriptKind.JSX : ts.ScriptKind.Unknown;
  const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true, scriptKind);
  const usedStyles = new Set<string>();

  function visitReferences(node: ts.Node) {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText() === "styles") {
      const propertyName = node.name.getText();
      usedStyles.add(propertyName);
    }
    ts.forEachChild(node, visitReferences);
  }
  ts.forEachChild(sourceFile, visitReferences);

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });

  const transformer = (context: ts.TransformationContext) => {
    return (node: ts.Node): ts.Node => {
      function visit(node: ts.Node): ts.Node {
        // Handle `StyleSheet.create` transformation
        if (
          ts.isVariableDeclaration(node) &&
          node.name.getText() === "styles" &&
          node.initializer &&
          ts.isCallExpression(node.initializer)
        ) {
          const arg = node.initializer.arguments[0];
          if (ts.isObjectLiteralExpression(arg)) {
            const properties = arg.properties.filter((property) => {
              if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
                const isUsed = usedStyles.has(property.name.text);
                !isUsed && !hasChanges && (hasChanges = true);
                return isUsed;
              }
              return true;
            });

            if (properties.length > 0) {
              return ts.factory.updateVariableDeclaration(
                node,
                node.name,
                node.exclamationToken,
                node.type,
                ts.factory.updateCallExpression(node.initializer, node.initializer.expression, undefined, [
                  ts.factory.updateObjectLiteralExpression(arg, properties),
                ]),
              );
            }
            // If no properties are left, set to empty obj
            return ts.factory.updateVariableDeclaration(
              node,
              node.name,
              node.exclamationToken,
              node.type,
              ts.factory.createObjectLiteralExpression([], true),
            );
          }
        }

        return ts.visitEachChild(node, visit, context);
      }

      return ts.visitNode(node, visit);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformedSourceFile = result.transformed[0] as ts.SourceFile;
  const updatedCode = printer.printFile(transformedSourceFile);

  result.dispose();

  if (hasChanges) {
    if (!isDryRun) {
      fs.writeFileSync(filePath, updatedCode, "utf-8");
      if (!noFormat) {
        formatFile(filePath, formatter);
      }
      log(`Updated file: ${filePath}`);
    } else {
      log(`Dry run: ${filePath} would be updated`);
    }
  } else {
    log(`No changes made to: ${filePath}`);
  }
};

const shouldIncludeFile = (filePath: string) => {
  const relativePath = path.relative(process.cwd(), filePath); // Make paths relative
  const includePatternsArray = includePatterns.trim().split(/\s+/); // Split by space
  const excludePatternsArray = excludePatterns.trim().split(/\s+/);

  const isIncluded = includePatternsArray.some((pattern) => minimatch(relativePath, pattern));
  const isExcluded = excludePatternsArray.some((pattern) => minimatch(relativePath, pattern));

  log("Matching:", relativePath, { isIncluded, isExcluded });

  return isIncluded && !isExcluded;
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
