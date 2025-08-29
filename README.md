# Mini KPI PWA

Mini KPI PWA is a minimal Progressive Web App built with Next.js 14 for tracking key performance indicators. The app demonstrates offline capability, local storage with IndexedDB, and export features.

## Installation

1. Install [Node.js](https://nodejs.org/) and npm.
2. Install dependencies:

```bash
npm install
```

3. (Optional) On Windows run `scripts/setup-tailwind.ps1` to set up Tailwind CSS.

## Basic Usage

### Development

```bash
npm run dev
```

Starts the development server with hot reloading.

### Build and production

```bash
npm run build
npm start
```

`npm run build` creates an optimized production build, and `npm start` serves the compiled app.

## Development Scripts

- `npm run dev` – start Next.js in development mode.
- `npm run build` – build the app for production.
- `npm start` – run the production build.

## Dependencies

- `next`, `react`, `react-dom` – application framework and UI library.
- `dexie` – IndexedDB wrapper for local storage.
- `docx` – generate Word documents.
- `exceljs` – export Excel files.
- `browser-image-compression` – client-side image compression.
- `uuid` – generate unique identifiers.
- Development: `tailwindcss`, `postcss`, `autoprefixer`, `next-pwa`, `typescript`.

