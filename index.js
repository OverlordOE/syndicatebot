const Discord = require('discord.js');
const winston = require('winston');
const moment = require('moment');
const cron = require('cron');
const DBL = require('dblapi.js');
const dbl = new DBL(process.env.DBL_TOKEN, { webhookPort: 3000, webhookAuth: process.env.WEBHOOK_TOKEN });
const clientCommands = require('./commands');
const { Users, Guilds, profile, guildProfile } = require('./dbObjects');
require('dotenv').config();
const client = new Discord.Client();
const cooldowns = new Discord.Collection();
const active = new Map();
client.commands = new Discord.Collection();
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
moment().format();

const logger = winston.createLogger({
	format: winston.format.combine(
		winston.format.timestamp({ format: 'MM-DD HH:mm:ss' }),
		winston.format.printf(log => `(${log.timestamp}) [${log.level}] - ${log.message}`),

	),
	transports: [
		new winston.transports.Console({
			format: winston.format.colorize({
				all: true,
				colors: {
					error: 'red',
					info: 'cyan',
					warn: 'yellow',
					debug: 'green',
				},
			}),
		}),
		new winston.transports.File({
			filename: './logs/error.log',
			level: 'warn',
			format: winston.format.json(),
		}),
		new winston.transports.File({ filename: './logs/log.log' }),
	],
});

// Load in Commands
Object.keys(clientCommands).map(key => 	client.commands.set(clientCommands[key].name, clientCommands[key]));

// Startup Tasks
client.login(process.env.TEST_TOKEN);
client.on('ready', async () => {
	try {
		const storedUsers = await Users.findAll();
		storedUsers.forEach(b => profile.set(b.user_id, b));
		const storedGuilds = await Guilds.findAll();
		storedGuilds.forEach(b => guildProfile.set(b.guild_id, b));
		let memberTotal = 0;
		client.guilds.cache.forEach(guild => { if (!isNaN(memberTotal) && guild.id != 264445053596991498) memberTotal += Number(guild.memberCount); });
		client.user.setActivity(`with ${memberTotal} users.`);

		logger.info(`Logged in as ${client.user.tag}!`);
	}
	catch (e) {
		logger.error(e.stack);
	}
});

// Logger
client.on('warn', e => logger.warn(e));
client.on('error', e => logger.error(e));
process.on('warning', e => logger.warn(e));
process.on('unhandledRejection', e => logger.error(e));
process.on('TypeError', e => logger.error(e));
process.on('uncaughtException', e => logger.error(e));

// Command handler
client.on('message', async message => {

	if (message.author.bot || message.channel == 'dm') return;

	let guild = guildProfile.get(message.guild.id);
	if (!guild) guild = await guildProfile.newGuild(message.guild.id);
	const prefix = await guildProfile.getPrefix(message.guild.id);
	const id = message.author.id;
	let user = await profile.get(id);
	if (!user) user = await profile.newUser(id);


	// split message for further use
	const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`);
	if (!prefixRegex.test(message.content)) return;

	const [, matchedPrefix] = message.content.match(prefixRegex);
	const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	// find command
	const command = client.commands.get(commandName)
		|| client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

	if (!command) return;
	if (command.category == 'debug' && (id != 137920111754346496 && id != 139030319784263681)) return message.channel.send('You are not the owner of this bot!');
	if (command.category == 'admin' && !message.member.hasPermission('ADMINISTRATOR') && id != 137920111754346496 && id != 139030319784263681) return message.channel.send('You need Admin privileges to use this command!');
	if (command.category == 'pvp') await profile.resetProtection(id);


	// if the command is used wrongly correct the user
	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;
		if (command.usage) reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
		return message.channel.send(reply);
	}


	// cooldowns
	if (id != 137920111754346496) {
		if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Discord.Collection());
		const timestamps = cooldowns.get(command.name);
		const cooldownAmount = (command.cooldown || 1.5) * 1000;
		const now = Date.now();

		if (timestamps.has(id)) {
			const expirationTime = timestamps.get(id) + cooldownAmount;

			if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / 1000;
				const hourLeft = timeLeft / 3600;
				const minLeft = (hourLeft - Math.floor(hourLeft)) * 60;
				const secLeft = Math.floor((minLeft - Math.floor(minLeft)) * 60);
				if (hourLeft >= 1) return message.reply(`Please wait **${Math.floor(hourLeft)} hours**, **${Math.floor(minLeft)} minutes** and **${secLeft} seconds** before reusing the \`${command.name}\` command.`);
				else if (minLeft >= 1) return message.reply(`Please wait **${Math.floor(minLeft)} minutes** and **${secLeft} seconds** before reusing the \`${command.name}\` command.`);
				else return message.reply(`Please wait **${timeLeft.toFixed(1)} second(s)** before reusing the \`${command.name}\` command.`);
			}
		}
		timestamps.set(id, now);
		setTimeout(() => timestamps.delete(id), cooldownAmount);
	}

	const options = { active: active };

	if (user.firstCommand) {
		client.commands.get('changelog').execute(message, args, user, profile, guildProfile, client, logger, cooldowns, options);
		user.firstCommand = false;
		logger.info(`New user ${message.author.tag}`);
		user.save();
	}

	// execute command
	logger.log('info', `${message.author.tag} Called command: ${commandName} ${args.join(' ')}, in guild: ${message.guild.name}`);
	try {
		command.execute(message, args, user, profile, guildProfile, client, logger, cooldowns, options);
	}
	catch (e) {
		logger.error(e.stack);
		message.reply('there was an error trying to execute that command!');
	}
});

// Regular tasks executed every 3 hours
const botTasks = new cron.CronJob('0 0-23/3 * * *', async () => {
	const lottery = client.commands.get('lottery');
	lottery.execute(profile, client, logger);

	let memberTotal = 0;
	client.guilds.cache.forEach(guild => { if (!isNaN(memberTotal) && guild.id != 264445053596991498) memberTotal += Number(guild.memberCount); });
	client.user.setActivity(`with ${memberTotal} users.`);

	logger.info('Finished regular tasks!');
});
botTasks.start();

dbl.webhook.on('ready', () => logger.info('DBL Webhook up and running.'));
dbl.on('error', e => logger.error(`Oops! ${e}`));

// DBL voting webhook handler
dbl.webhook.on('vote', async vote => {

	const userID = vote.user;
	const user = await client.users.cache.get(userID);
	let msgUser = await profile.get(userID);
	if (!msgUser) msgUser = await profile.newUser(userID);
	logger.info(`${user.tag} has just voted.`);

	const embed = new Discord.MessageEmbed()
		.setTitle('Vote Reward')
		.setThumbnail(user.displayAvatarURL())
		.setColor(msgUser.pColour)

		.setFooter('Neia', client.user.displayAvatarURL());

	let chest;
	const luck = Math.floor(Math.random() * 7);
	if (luck == 0) chest = 'Epic chest';
	if (luck == 1) chest = 'Mystery chest';
	else chest = 'Rare chest';
	chest = await profile.getItem(chest);

	if (chest.picture) {
		embed.attachFiles(`assets/items/${chest.picture}`)
			.setImage(`attachment://${chest.picture}`);
	}

	const income = await profile.calculateIncome(userID);
	profile.addMoney(userID, income.daily);
	profile.addItem(userID, chest, 1);
	profile.setVote(userID);

	return user.send(embed.setDescription(`Thank you for voting!\n\nYou got a ${chest.emoji}${chest.name} from your vote 🎁 and ${profile.formatNumber(income.daily)}💰 from your collectables.\nCome back in 12 hours for more!\n\nYour current balance is ${profile.formatNumber(await profile.getBalance(userID))}💰`));
});