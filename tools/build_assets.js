const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const destDir = path.resolve(srcDir, 'www');

// Items to copy to production build
const itemsToCopy = [
    'index.html',
    'dashboard.html',
    'manifest.json',
    'manifest.parent.json',
    'manifest.student.json',
    'manifest.teacher.json',
    'sw.js',
    'offline.html',
    'css',
    'js',
    'pages',
    'assets',
    'locales'
];

console.log('Cleaning existing www directory...');
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

console.log('Copying production assets...');
itemsToCopy.forEach(item => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);

    if (fs.existsSync(srcPath)) {
        console.log(`Copying ${item}...`);
        fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
        console.warn(`Warning: ${item} not found at ${srcPath}`);
    }
});

console.log('Build completed successfully! Web assets are in the www folder.');
