# Seed Language VS Code Extension

VS Code extension for the Seed language (`.tree` files). Provides syntax
highlighting, hover, go-to-definition, completions, find references,
document symbols, and folding ranges.

## Setup

### 1. Build Dependencies

Build the parser and compiler first:

```bash
cd deck/tree
pnpm make

cd deck/seed/deck/mesh.tree
pnpm make
```

### 2. Build the Language Server

```bash
cd deck/seed/deck/make.tree
pnpm make
```

### 3. Install Extension Dependencies

```bash
cd deck/seed/deck/make.tree/vscode
pnpm install
```

### 4. Run in VS Code

1. Open `deck/seed/deck/make.tree/vscode/` as a folder in VS Code
2. Press `F5` (Run > Start Debugging)
3. A new VS Code window opens with the extension loaded
4. Open a folder with `.tree` files (e.g. `deck/seed/deck/base.tree/`)
5. Open a `.tree` file

## Features

### Always Available (TextMate Grammar)

- Syntax highlighting for `.tree` files
- Comment toggling with `#`
- Bracket matching for `()`, `{}`, `[]`, `<>`
- File icons (enable the "Tree" icon theme in settings)
- Syntax highlighting in markdown `tree` code blocks

### With Language Server

- Parse error diagnostics inline as you type
- Hover for type info on symbols
- Go-to-definition (`Cmd+Click` or `F12`)
- Completions (keywords, symbols, types)
- Find references (`Shift+F12`)
- Document symbols / outline (`Cmd+Shift+O`)
- Folding for definitions and load groups

## Debugging

- Server logs: Output panel > "Seed Language Server"
- Extension errors: `Cmd+Shift+I` (Developer Tools)
- Missing dependencies show warnings in server stderr

## Install as VSIX

```bash
cd deck/seed/deck/make.tree/vscode
npx vsce package
```

Then in VS Code: `Cmd+Shift+P` > "Extensions: Install from VSIX..." and
select the generated `.vsix` file.
