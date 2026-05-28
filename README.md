# vendrix-plugins

Custom Vencord plugins shipped with [Vendrix](https://github.com/relawiii/Vendrix).

## Plugins

### `dynamicActivity`
Sets your Discord Rich Presence / custom status automatically based on what channel/guild you're in. Supports playing, streaming, listening, watching, and competing activity types.

## Usage

These plugins are designed to be dropped into a Vencord source tree under `src/userplugins/`.

```
src/
└── userplugins/
    └── dynamicActivity/
        └── index.tsx   ← copy from this repo
```

Then build Vencord normally (`pnpm build` / `pnpm watch`).

## Development

Each plugin lives in its own folder named after the plugin. The folder must contain at least an `index.tsx` (or `index.ts`) that exports a `definePlugin(...)` default export.

```
vendrix-plugins/
└── myPlugin/
    └── index.tsx
```

## License

GPL-3.0-or-later — same as Vencord.
