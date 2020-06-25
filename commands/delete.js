module.exports = {
	name: 'delete',
	description: 'Delete messages in bulk.',
	admin: true,
	aliases: ['remove'],
	args: false,
	usage: '(amount of messaged to delete)',
	owner: false,
	cooldown: 4,
	music: false,

	execute(msg, args, profile, bot, options, ytAPI, logger, cooldowns) {

		try {
			msg.delete();
			msg.channel.bulkDelete(args[0]);
			logger.log('info', `${msg.author.tag} deleted ${args[0]} messages in channel ${msg.channel.name}`);
		}
		catch (error) {
			msg.channel.send('Something went wrong');
			return logger.error(error.stack);
		}
	},
};
