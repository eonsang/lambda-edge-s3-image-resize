rm -rf node_modules
rm lambda.zip
rm package-lock.json
rm index.js

npm uninstall sharp
npm install
npm install --platform=linux --arch=x64 sharp@0.32.6

tsc
zip -r lambda.zip index.js node_modules package.json