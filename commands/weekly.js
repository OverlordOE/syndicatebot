const Discord = require('discord.js');
const { Users, CurrencyShop } = require('../dbObjects');
const { Op } = require('sequelize');
module.exports = {
	name: 'weekly',
	summary: 'Get a weekly gift',
	description: 'Get a weekly gift.',
	category: 'money',
	aliases: ['week', 'w'],
	args: false,
	cooldown: 5,
	usage: '',

	async execute(msg, args, msgUser, profile, guildProfile, bot, options, logger, cooldowns) {
		const weekly = await profile.getWeekly(msg.author.id);
		const user = await Users.findOne({ where: { user_id: msg.author.id } });
		const avatar = msg.author.displayAvatarURL();
		let chest;
		
		const luck = Math.floor(Math.random() * 2);
		if (luck >= 1) chest = 'Legendary chest';
		else chest = 'Epic chest';
		const item = await CurrencyShop.findOne({ where: { name: { [Op.like]: chest } } });


		const embed = new Discord.MessageEmbed()
			.setTitle('Weekly Reward')
			.setThumbnail(avatar)
			.setColor(msgUser.pColour)
			.setTimestamp()
			.setFooter('Neia', bot.user.displayAvatarURL());

		if (item.picture) embed.attachFiles(`assets/items/${item.picture}`)
			.setImage(`attachment://${item.picture}`);


		if (weekly === true) {
			await user.addItem(item, 1);
			await profile.setWeekly(msg.author.id);
			msg.channel.send(embed.setDescription(`You got a ${item.emoji}${item.name} from your weekly 🎁\nCome back in a week for more!`));
		}
		else { msg.channel.send(embed.setDescription(`You have already gotten your weekly 🎁\n\nYou can get you next weekly __${weekly}__`)); }
	},
};