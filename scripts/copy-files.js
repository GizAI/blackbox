const fs = require('fs');
const path = require('path');

// Paths
const srcDir = path.join(__dirname, '../src');
const distDir = path.join(__dirname, '../dist');

// Files to copy
const filesToCopy = [
  { src: path.join(srcDir, 'renderer/preload.js'), dest: path.join(distDir, 'renderer/preload.js') },
  { src: path.join(srcDir, 'renderer/index.html'), dest: path.join(distDir, 'renderer/index.html') },
  { src: path.join(srcDir, 'renderer/audio-recorder.js'), dest: path.join(distDir, 'renderer/audio-recorder.js') },
  { src: path.join(srcDir, 'renderer/styles.css'), dest: path.join(distDir, 'renderer/styles.css') },
  { src: path.join(srcDir, 'renderer/navigation.js'), dest: path.join(distDir, 'renderer/navigation.js') },
  { src: path.join(srcDir, 'renderer/main.js'), dest: path.join(distDir, 'renderer/main.js') },
  { src: path.join(srcDir, 'renderer/dashboard.js'), dest: path.join(distDir, 'renderer/dashboard.js') },
  { src: path.join(srcDir, 'renderer/timeline.js'), dest: path.join(distDir, 'renderer/timeline.js') },
  { src: path.join(srcDir, 'renderer/settings.js'), dest: path.join(distDir, 'renderer/settings.js') },
  { src: path.join(srcDir, 'renderer/insights.js'), dest: path.join(distDir, 'renderer/insights.js') },
  { src: path.join(srcDir, 'common/utils.js'), dest: path.join(distDir, 'common/utils.js') },
  { src: path.join(srcDir, 'common/types.ts'), dest: path.join(distDir, 'common/types.js') },
  { src: path.join(srcDir, 'common/constants.ts'), dest: path.join(distDir, 'common/constants.js') },
  { src: path.join(srcDir, 'common/events.ts'), dest: path.join(distDir, 'common/events.js') },
  { src: path.join(srcDir, 'renderer/components/timeline-renderer.js'), dest: path.join(distDir, 'renderer/components/timeline-renderer.js') }
];

// Ensure directory exists
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExists(dirname);
  fs.mkdirSync(dirname);
}

// Copy files
function copyFiles() {
  filesToCopy.forEach(file => {
    try {
      // Ensure destination directory exists
      ensureDirectoryExists(file.dest);

      // Copy file
      fs.copyFileSync(file.src, file.dest);
      console.log(`Copied: ${file.src} -> ${file.dest}`);
    } catch (error) {
      console.error(`Error copying file ${file.src}:`, error);
    }
  });
}

// Execute
copyFiles();
