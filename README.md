# ZZTetris

[![Discord Shield](https://discordapp.com/api/guilds/948358018247032883/widget.png?style=shield)](https://discord.gg/Z3qDF4DVxJ)
[![Open issues](https://img.shields.io/github/issues/g3ner1c/wikimedia-cli)](https://github.com/swng/zztetris/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/g3ner1c/wikimedia-cli)](https://github.com/swng/zztetris/pulls)
[![License](https://img.shields.io/github/license/swng/zztetris)](./LICENSE)
[![Repo stars](https://img.shields.io/github/stars/swng/zztetris?style=social)](https://github.com/swng/zztetris/stargazers)

**[Join the Project Discord!](https://discord.gg/Z3qDF4DVxJ)**

**[Read the Docs!](https://github.com/swng/zztetris/wiki)**

A tetris client with a name that starts with zz so you can type zz and have it autocomplete

Forked from [aznguy's schoolteto](https://github.com/aznguymp4/schoolTeto) with a number of features added

Inspired by fio's four-tris

## Features (probably buggy lol)

- Fumen import/export
- Image import works through clipboard
- Undo/redo with board history
- *Full* fumen import/export sets your board state history as the fumen pages and vice versa.
- Drawing garbage on the board

## Engines (WASM)

ZZTetris uses high-performance Tetris engines compiled to WebAssembly. The engines are included as Git submodules in the `engines/` directory.

### Building the Engines

To build the WASM binaries, you need [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/).

Run the build script from the `zztetris` directory:

```bash
./build_wasm.sh
```

### Running the Visualizer

Because ZZTetris uses WebAssembly ES modules, it **cannot be opened directly as a file** (`file://`). You must use a local web server.

Run the provided start script:

```bash
./start_web.sh
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Development

The submodules track the `devel` branch of their respective repositories. To pull the latest changes:

```bash
git submodule update --remote --recursive
```

## Engine API Configuration

ZZTetris can also connect to remote engine services via HTTP. Edit `engine.config.json` to set the base URLs:

```json
{
  "fusionApiBase": "http://127.0.0.1:8787",
  "falconApiBase": "http://127.0.0.1:8888"
}
```

## TODO

- fix DAS stuff more?
- add alternate kick tables
