# Project Notes

## Netlify Build Fix - Invalid Version Error

### Problem
Netlify builds fail with `npm error Invalid Version:` during dependency installation.

### Cause
npm creates placeholder entries for platform-specific optional dependencies (like `@esbuild/android-arm64`) without version fields when generating `package-lock.json` on macOS. These invalid entries cause npm to fail on Netlify's Linux environment.

Example of invalid entry:
```json
"node_modules/esbuild/node_modules/@esbuild/android-arm64": {
  "dev": true,
  "optional": true
}
```

### Fix
After regenerating `package-lock.json`, run this command to remove invalid entries:

```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const [name, info] of Object.entries(pkg.packages || {})) {
  if (name !== '' && !info.version) {
    delete pkg.packages[name];
    console.log('Removed:', name);
  }
}
fs.writeFileSync('package-lock.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

### Date
March 30, 2026
