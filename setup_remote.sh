cd Microsoft-Rewards-Script
echo '[{"email":"diogocrespi@hotmail.com","password":"DiogoVinicioscrespi12@","totp":"","geoLocale":"auto","proxy":{"proxyAxios":true,"url":"","port":0,"username":"","password":""}}]' > src/accounts.json
cp src/config.example.json src/config.json
sed -i "s/headless: this.bot.config.headless,/executablePath: '\/usr\/bin\/chromium', headless: this.bot.config.headless,/" src/browser/Browser.ts
npm ci
npm run build
