#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const core_1 = require("@babel/core");
const traverse_1 = __importDefault(require("@babel/traverse"));
const parser_1 = require("@babel/parser");
const commander_1 = require("commander");
const minimatch_1 = require("minimatch");
const t = __importStar(require("@babel/types"));
const program = new commander_1.Command();
program
    .option('-d, --directory <path>', 'directory to parse', 'src')
    .option('-i, --include <patterns>', 'file patterns to include', '**/*.{jsx,tsx}')
    .option('-e, --exclude <patterns>', 'file patterns to exclude', '')
    .option('--dry-run', 'run without making any changes')
    .option('--verbose', 'output detailed information')
    .parse(process.argv);
const options = program.opts();
const directoryPath = node_path_1.default.isAbsolute(options.directory) ? options.directory : node_path_1.default.resolve(process.cwd(), options.directory);
const includePatterns = options.include;
const excludePatterns = options.exclude;
const isDryRun = options.dryRun;
const isVerbose = options.verbose;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const log = (message, ...optionalParams) => {
    if (isVerbose) {
        console.log(message, ...optionalParams);
    }
};
const parseFile = (filePath) => {
    const code = node_fs_1.default.readFileSync(filePath, "utf-8");
    const ast = (0, parser_1.parse)(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
    });
    const usedStyles = new Set();
    const styleSheetName = "styles";
    (0, traverse_1.default)(ast, {
        MemberExpression(path) {
            if (path.node.object &&
                ("name" in path.node.object) &&
                path.node.object.name === styleSheetName &&
                path.node.property &&
                ("name" in path.node.property) &&
                path.node.property.name) {
                usedStyles.add(path.node.property.name);
            }
        },
    });
    (0, traverse_1.default)(ast, {
        VariableDeclarator(path) {
            const { node } = path;
            if (t.isIdentifier(node.id, { name: styleSheetName }) &&
                t.isCallExpression(node.init) &&
                t.isMemberExpression(node.init.callee) &&
                t.isIdentifier(node.init.callee.object, { name: "StyleSheet" }) &&
                t.isIdentifier(node.init.callee.property, { name: "create" })) {
                const styleObject = node.init.arguments[0];
                if (t.isObjectExpression(styleObject)) {
                    styleObject.properties = styleObject.properties.filter((property) => {
                        const keep = t.isObjectProperty(property) &&
                            t.isIdentifier(property.key) &&
                            usedStyles.has(property.key.name);
                        log(
                        // @ts-ignore
                        `Property ${property.key.name} is ${keep ? "kept" : "removed"}`);
                        return keep;
                    });
                }
            }
        },
    });
    const result = (0, core_1.transformFromAstSync)(ast, code, {
        filename: filePath,
        plugins: ["@babel/plugin-syntax-jsx"],
        presets: [/* "@babel/preset-react", */ "@babel/preset-typescript"],
        generatorOpts: { compact: false, retainLines: true, comments: true },
    });
    if (result === null || result === void 0 ? void 0 : result.code) {
        if (!isDryRun) {
            node_fs_1.default.writeFileSync(filePath, result.code, "utf-8");
            log(`Updated file: ${filePath}`);
        }
        else {
            log(`Dry run: ${filePath} would be updated`);
        }
    }
};
const shouldIncludeFile = (filePath) => {
    const relativePath = node_path_1.default.relative(process.cwd(), filePath); // Make paths relative
    const includePatternsArray = includePatterns.trim().split(/\s+/); // Split by space
    const excludePatternsArray = excludePatterns.trim().split(/\s+/);
    const isIncluded = includePatternsArray.some((pattern) => (0, minimatch_1.minimatch)(relativePath, pattern));
    const isExcluded = excludePatternsArray.some((pattern) => (0, minimatch_1.minimatch)(relativePath, pattern));
    log("Matching:", relativePath, { isIncluded, isExcluded });
    return isIncluded && !isExcluded;
};
const parseDirectory = (dirPath) => {
    const files = node_fs_1.default.readdirSync(dirPath);
    console.log(dirPath, files.length);
    for (const file of files) {
        const filePath = node_path_1.default.join(dirPath, file);
        if (node_fs_1.default.statSync(filePath).isDirectory()) {
            parseDirectory(filePath);
        }
        else if (shouldIncludeFile(filePath)) {
            parseFile(filePath);
        }
    }
};
parseDirectory(directoryPath);
