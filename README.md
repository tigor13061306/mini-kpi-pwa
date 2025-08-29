# Mini KPI PWA

## Overview
Mini KPI PWA is a lightweight progressive web application for tracking key performance indicators. Built with Next.js and Tailwind CSS, it provides an offline-capable interface for managing metrics.

### Features
- Offline-first PWA with service worker caching
- Local data storage via Dexie.js
- Export KPI data to Excel or Word
- Responsive design powered by Tailwind CSS

## Requirements
- Node.js 18+
- npm

## Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## Build and Deployment
- Build the application for production:
  ```bash
  npm run build
  ```
- Start the production server:
  ```bash
  npm start
  ```
Deploy the `.next` output to your preferred hosting platform. Ensure service workers are served over HTTPS to enable PWA features.

## Contributing
Contributions are welcome! Please open issues or submit pull requests to suggest improvements or fixes.

## License
This project is licensed under the MIT License.

