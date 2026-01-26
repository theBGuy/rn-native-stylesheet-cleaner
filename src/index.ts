#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { minimatch } from "minimatch";
import ts from "typescript";
import { version } from "../package.json";
import { detectFormatter, formatFile } from "./utils";

const program = new Command();

interface StyleSheetInfo {
  variableName: string;
  usedStyles: Set<string>;
  hasComputedAccess: boolean; // If true, we can't safely remove any styles
}

program
  .version(version, "-v, --version", "output the current version")
  .option("-d, --directory <path>", "directory to parse", "src")
  .option("-i, --include <patterns>", "file patterns to include", "**/*.{jsx,tsx}")
  .option("-e, --exclude <patterns>", "file patterns to exclude", "")
  .option("--no-format", "run without formatting the output")
  .option("--dry-run", "run without making any changes")
  .option("--verbose", "output detailed information")
  .action(async (options) => {
    const directoryPath = path.isAbsolute(options.directory)
      ? options.directory
      : path.resolve(process.cwd(), options.directory);
    const includePatterns: string = options.include;
    const excludePatterns: string = options.exclude;
    const isDryRun = options.dryRun;
    const isVerbose = options.verbose;
    const noFormat = options.format === false;
    const formatter = detectFormatter(process.cwd());

    const log = (message?: unknown, ...optionalParams: unknown[]) => {
      if (isVerbose) {
        console.log(message, ...optionalParams);
      }
    };

    log(formatter ? `${formatter} detected` : "No formatter detected; skipping formatting.");

    /**
     * Find all StyleSheet.create variable declarations and collect info about them
     */
    const findStyleSheetVariables = (sourceFile: ts.SourceFile): Map<string, StyleSheetInfo> => {
      const styleSheets = new Map<string, StyleSheetInfo>();

      function visit(node: ts.Node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.initializer &&
          ts.isCallExpression(node.initializer) &&
          ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.getText() === "StyleSheet.create"
        ) {
          const variableName = node.name.text;
          styleSheets.set(variableName, {
            variableName,
            usedStyles: new Set<string>(),
            hasComputedAccess: false,
          });
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);
      return styleSheets;
    };

    /**
     * Collect all style references for the given stylesheet variables
     */
    const collectStyleReferences = (sourceFile: ts.SourceFile, styleSheets: Map<string, StyleSheetInfo>) => {
      function visit(node: ts.Node) {
        // Handle: styles.propertyName
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
          const objName = node.expression.text;
          const info = styleSheets.get(objName);
          if (info) {
            const propertyName = node.name.getText();
            info.usedStyles.add(propertyName);
          }
        }

        // Handle: styles['propertyName'] or styles["propertyName"]
        if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
          const objName = node.expression.text;
          const info = styleSheets.get(objName);
          if (info) {
            if (ts.isStringLiteral(node.argumentExpression)) {
              info.usedStyles.add(node.argumentExpression.text);
            } else {
              // Dynamic access like styles[variable] - mark as having computed access
              info.hasComputedAccess = true;
            }
          }
        }

        // Handle destructuring: const { container, text } = styles;
        if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
          if (ts.isIdentifier(node.initializer)) {
            const objName = node.initializer.text;
            const info = styleSheets.get(objName);
            if (info) {
              for (const element of node.name.elements) {
                if (ts.isBindingElement(element)) {
                  // Handle renamed destructuring: { container: myContainer }
                  if (element.propertyName && ts.isIdentifier(element.propertyName)) {
                    info.usedStyles.add(element.propertyName.text);
                  } else if (ts.isIdentifier(element.name)) {
                    info.usedStyles.add(element.name.text);
                  }
                }
              }
            }
          }
        }

        // Handle spread: ...styles (marks all as used since we can't know which)
        if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) {
          const spreadExpr = ts.isSpreadAssignment(node) ? node.expression : node.expression;
          if (ts.isIdentifier(spreadExpr)) {
            const info = styleSheets.get(spreadExpr.text);
            if (info) {
              info.hasComputedAccess = true;
            }
          }
        }

        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);
    };

    /**
     * Replace stylesheet in source code using AST positions (preserves formatting)
     */
    const replaceStyleSheetByPosition = (
      sourceCode: string,
      sourceFile: ts.SourceFile,
      variableName: string,
      usedStyles: Set<string>,
    ): string => {
      let result = sourceCode;
      let offset = 0;

      function visit(node: ts.Node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === variableName &&
          node.initializer &&
          ts.isCallExpression(node.initializer) &&
          ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.getText() === "StyleSheet.create"
        ) {
          const arg = node.initializer.arguments[0];
          if (ts.isObjectLiteralExpression(arg)) {
            const propertiesToKeep: string[] = [];
            const propertiesToRemove: Array<{ start: number; end: number }> = [];

            for (let i = 0; i < arg.properties.length; i++) {
              const property = arg.properties[i];

              // Get the property name
              let propName: string | null = null;
              if (ts.isPropertyAssignment(property)) {
                if (ts.isIdentifier(property.name)) {
                  propName = property.name.text;
                } else if (ts.isStringLiteral(property.name)) {
                  propName = property.name.text;
                } else if (ts.isComputedPropertyName(property.name)) {
                  // Can't statically analyze computed property names - keep them
                  propertiesToKeep.push("[computed]");
                  continue;
                }
              } else if (ts.isShorthandPropertyAssignment(property)) {
                propName = property.name.text;
              } else if (ts.isSpreadAssignment(property)) {
                // Keep spread assignments
                propertiesToKeep.push("[spread]");
                continue;
              }

              if (propName !== null) {
                if (usedStyles.has(propName)) {
                  propertiesToKeep.push(propName);
                } else {
                  // Calculate the range to remove (including trailing comma if present)
                  let start = property.getStart(sourceFile);
                  let end = property.getEnd();

                  // Look for trailing comma
                  const nextToken = sourceCode.substring(end).match(/^\s*,/);
                  if (nextToken) {
                    end += nextToken[0].length;
                  }

                  // If this is not the first property and there's no trailing comma,
                  // we need to remove the leading comma instead
                  if (i > 0 && !nextToken) {
                    const prevText = sourceCode.substring(arg.properties[i - 1].getEnd(), start);
                    const leadingComma = prevText.match(/,\s*$/);
                    if (leadingComma) {
                      start -= leadingComma[0].length;
                    }
                  }

                  propertiesToRemove.push({ start, end });
                }
              }
            }

            // Apply removals in reverse order to preserve positions
            propertiesToRemove.sort((a, b) => b.start - a.start);
            for (const range of propertiesToRemove) {
              const adjustedStart = range.start + offset;
              const adjustedEnd = range.end + offset;
              result = result.substring(0, adjustedStart) + result.substring(adjustedEnd);
              offset -= range.end - range.start;
            }

            // Clean up any leftover formatting issues (multiple commas, trailing commas before })
            // This is a light cleanup, not a full reformat
            result = result.replace(/,(\s*,)+/g, ","); // multiple commas
            result = result.replace(/,(\s*)\}/g, "$1}"); // trailing comma before }
            result = result.replace(/\{(\s*),/g, "{$1"); // leading comma after {
          }
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);

      return result;
    };

    const parseFile = async (filePath: string) => {
      let sourceCode: string;
      try {
        sourceCode = fs.readFileSync(filePath, "utf-8");
      } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);
        return;
      }

      const isTsx = filePath.endsWith(".tsx");
      const isJsx = filePath.endsWith(".jsx");

      const scriptKind = isTsx ? ts.ScriptKind.TSX : isJsx ? ts.ScriptKind.JSX : ts.ScriptKind.Unknown;
      const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true, scriptKind);

      // Find all StyleSheet.create declarations
      const styleSheets = findStyleSheetVariables(sourceFile);

      if (styleSheets.size === 0) {
        log(`No StyleSheet.create found in: ${filePath}`);
        return;
      }

      // Collect all style references
      collectStyleReferences(sourceFile, styleSheets);

      let hasChanges = false;
      let updatedCode = sourceCode;

      // Process each stylesheet
      for (const [variableName, info] of styleSheets) {
        if (info.hasComputedAccess) {
          log(`Skipping ${variableName} in ${filePath} - has dynamic/computed access`);
          continue;
        }

        // Re-parse to get fresh positions after each modification
        const currentSourceFile = ts.createSourceFile(filePath, updatedCode, ts.ScriptTarget.Latest, true, scriptKind);

        const definedStyles = getDefinedStyles(currentSourceFile, variableName);
        const unusedStyles = [...definedStyles].filter((style) => !info.usedStyles.has(style));

        if (unusedStyles.length > 0) {
          hasChanges = true;
          log(`Removing unused styles from ${variableName}:`, unusedStyles);
          updatedCode = replaceStyleSheetByPosition(updatedCode, currentSourceFile, variableName, info.usedStyles);
        }
      }

      if (hasChanges) {
        if (!isDryRun) {
          try {
            fs.writeFileSync(filePath, updatedCode, "utf-8");
            if (!noFormat && formatter) {
              await formatFile(filePath, formatter);
            }
            log(`Updated file: ${filePath}`);
          } catch (err) {
            console.error(`Error writing file ${filePath}:`, err);
          }
        } else {
          log(`Dry run: ${filePath} would be updated`);
        }
      } else {
        log(`No changes made to: ${filePath}`);
      }
    };

    /**
     * Get all defined style names in a StyleSheet.create call
     */
    const getDefinedStyles = (sourceFile: ts.SourceFile, variableName: string): Set<string> => {
      const styles = new Set<string>();

      function visit(node: ts.Node) {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === variableName &&
          node.initializer &&
          ts.isCallExpression(node.initializer) &&
          ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.getText() === "StyleSheet.create"
        ) {
          const arg = node.initializer.arguments[0];
          if (ts.isObjectLiteralExpression(arg)) {
            for (const property of arg.properties) {
              if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
                if (ts.isIdentifier(property.name)) {
                  styles.add(property.name.text);
                } else if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name)) {
                  styles.add(property.name.text);
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      ts.forEachChild(sourceFile, visit);
      return styles;
    };

    const shouldIncludeFile = (filePath: string) => {
      const relativePath = path.relative(process.cwd(), filePath);
      // Normalize path separators for cross-platform glob matching
      const normalizedPath = relativePath.replace(/\\/g, "/");

      const includePatternsArray = includePatterns
        .trim()
        .split(/\s+/)
        .filter((p) => p.length > 0);
      const excludePatternsArray = excludePatterns
        .trim()
        .split(/\s+/)
        .filter((p) => p.length > 0);

      const isIncluded = includePatternsArray.some((pattern) => minimatch(normalizedPath, pattern));
      const isExcluded =
        excludePatternsArray.length > 0 && excludePatternsArray.some((pattern) => minimatch(normalizedPath, pattern));

      log("Matching:", normalizedPath, { isIncluded, isExcluded });

      return isIncluded && !isExcluded;
    };

    const parseDirectory = async (dirPath: string) => {
      let files: string[];
      try {
        files = fs.readdirSync(dirPath);
      } catch (err) {
        console.error(`Error reading directory ${dirPath}:`, err);
        return;
      }

      log(dirPath, files.length);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          if (fs.statSync(filePath).isDirectory()) {
            await parseDirectory(filePath);
          } else if (shouldIncludeFile(filePath)) {
            await parseFile(filePath);
          }
        } catch (err) {
          console.error(`Error processing ${filePath}:`, err);
        }
      }
    };

    await parseDirectory(directoryPath);
  });

program.parse(process.argv);
