# RN Native Stylesheet Cleaner

![NPM Downloads](https://img.shields.io/npm/d18m/rn-native-stylesheet-cleaner)

This project is a utility tool designed to clean and optimize React Native stylesheets. It helps in removing unused styles and organizing the stylesheet for better readability and maintainability.

## Why

As of right now I've noticed biome and eslint both miss when we have unused style props and it's annoying to go through and manually remove leftover ones. So, I made this. Hope this speeds up your workflow and leads to less clutter in your files.

## Features

- Identifies and removes unused styles
- ~~Organizes styles for better readability~~ TODO
- Supports both JavaScript and TypeScript React Native projects

## Installation

To install the RN Native Stylesheet Cleaner, you can use npm or yarn:

```bash
npm install -g rn-native-stylesheet-cleaner
```

or

```bash
yarn global add rn-native-stylesheet-cleaner
```

## Usage

To use the RN Native Stylesheet Cleaner, navigate to your React Native project directory and run the following command:

```bash
rn-native-stylesheet-cleaner
```

You can also use the shorthand command:

```bash
rn-ss-cleaner
```

This will scan your project for stylesheets, identify unused styles, and clean them up.

### Options

- `-d, --directory <path>`: Directory to parse (default: `src`)
- `-i, --include <patterns>`: File patterns to include (default: `**/*.{jsx,tsx}`)
- `-e, --exclude <patterns>`: File patterns to exclude (default: `''`)
- `--no-format`: Run the cleaner without reformatting the output.
- `--dry-run`: Run the cleaner without making any changes, just to see what would be cleaned.
- `--verbose`: Output detailed information during the cleaning process.

Example:

```bash
rn-native-stylesheet-cleaner --dry-run --verbose
```

## Warning

Note: The formatting of the outputted code will be initially removed during the cleaning process. However, if you have Prettier or Biome installed, the code will be reformatted automatically. The reformatting behavior is still experimental, and extra whitespace may still be stripped. You can turn off this behavior by using the `--no-format` flag if you prefer to handle formatting manually.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your changes.

## License

This project is licensed under the MIT License.
