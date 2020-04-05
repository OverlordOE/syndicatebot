const ytdl = require('ytdl-core-discord');
const YouTube = require("discord-youtube-api");

module.exports = {
	name: 'play',
	description: 'Play a song.',
	admin: false,
	aliases: ["song"],
	args: true,
	usage: 'search criteria',
	async execute(msg, args, profile, bot, ops, ytAPI, logger) {

		const youtube = new YouTube(ytAPI);
		if (!msg.member.voice.channel) {
			return msg.reply("You are not in a voice channel!")
		}
		var search = args.join(' ');

		logger.log('info', search);

		var data = ops.active.get(msg.guild.id) || {};
		if (!data.connection) data.connection = await msg.member.voice.channel.join();
		if (!data.queue) data.queue = [];
		data.guildID = msg.guild.id;

		var validate = await ytdl.validateURL(search);

		if (!validate) {
			var video = await youtube.searchVideos(search);

			data.queue.push({
				songTitle: video.title,
				requester: msg.author.tag,
				url: video.url,
				announceChannel: msg.channel.id
			});
		} else if (validate) {
			var video = await ytdl.getInfo(search);

			data.queue.push({
				songTitle: video.title,
				requester: msg.author.tag,
				url: search,
				announceChannel: msg.channel.id
			});

		}
		else return msg.reply("Cannot play this query");



		if (!data.dispatcher) {
			Play(bot, ops, data, logger);
		} else {
			msg.channel.send(`Added ${video.title} to the queue - Requested by ${msg.author.tag}`);
		}

		ops.active.set(msg.guild.id, data);
	},
}


async function Play(bot, ops, data, logger) {

	let message = bot.channels.cache.get(data.queue[0].announceChannel);
	message.send(`Now playing ${data.queue[0].songTitle}\nRequested by ${data.queue[0].requester}`);
	logger.log('info', `Now playing ${data.queue[0].songTitle} - Requested by ${data.queue[0].requester}`);
	
	var options = { type: 'opus' };

	data.dispatcher = data.connection.play(await ytdl(data.queue[0].url, {
		filter: 'audioonly',
		highWaterMark: 1 << 25,
	}), options);
	data.dispatcher.guildID = data.guildID;

	data.dispatcher.on('finish', () => {
		logger.log('info',`${data.queue[0].songTitle} has finished playing!`);
		Finish(bot, ops, data.dispatcher, logger, message);
	});

	data.dispatcher.on('error', e => {
		message.send(`error:  ${e}`);
		logger.log('error', e);
	});


}


function Finish(bot, ops, dispatcher,logger ,message) {

	var fetchedData = ops.active.get(dispatcher.guildID);
	fetchedData.queue.shift();

	if (fetchedData.queue.length > 0) {
		ops.active.set(dispatcher.guildID, fetchedData);
		Play(bot, ops, fetchedData);
	} else {

		ops.active.delete(dispatcher.guildID);
		message.send(`Queue has finished playing`);
		var voiceChannel = bot.guilds.cache.get(dispatcher.guildID).me.voice.channel;
		if (voiceChannel) voiceChannel.leave();

	}
}
