const Sequelize = require('sequelize');

//Initialize new DB
const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

//Import tables
const CurrencyShop = sequelize.import('models/CurrencyShop');
sequelize.import('models/Users');
sequelize.import('models/UserItems');

//Execute node dbInit.js --force or node dbInit.js -f to force update the tables.
const force = process.argv.includes('--force') || process.argv.includes('-f');

//Create tags
sequelize.sync({ force }).then(async () => {
	const shop = [
		CurrencyShop.upsert({ name: 'Tea', cost: 2 }),
		CurrencyShop.upsert({ name: 'Coffee', cost: 3 }),
		CurrencyShop.upsert({ name: 'Cake', cost: 6 }),
		CurrencyShop.upsert({ name: 'Custom-Role', cost: 100 }),
		CurrencyShop.upsert({ name: 'Text-Channel', cost: 250 }),
	];
	await Promise.all(shop);
	console.log('Database synced');
	sequelize.close();
}).catch(console.error);
