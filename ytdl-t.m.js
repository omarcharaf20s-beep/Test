require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);

const YT_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

bot.start(ctx =>
  ctx.reply('Send me a YouTube link and choose Audio or Video! 📥')
);

bot.on('text', async ctx => {
  const text = ctx.message.text;
  const match = text.match(YT_REGEX);

  if (!match) {
    return ctx.reply('❗ Please send a valid YouTube link.');
  }
  const videoId = match[1];

  ctx.reply(
    'Do you want to download as video or audio?',
    Markup.inlineKeyboard([
      [Markup.button.callback('🎥 Video', `video_${videoId}`), Markup.button.callback('🎵 Audio', `audio_${videoId}`)]
    ])
  );
});

bot.action(/^(video|audio)_(.+)$/, async ctx => {
  const [, type, videoId] = ctx.match;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const chatId = ctx.chat.id;
  await ctx.answerCbQuery();

  let info;
  try {
    info = await ytdl.getInfo(url);
  } catch (e) {
    return ctx.reply('❌ Failed to get video info.');
  }
  const title = info.videoDetails.title.replace(/[^\w\s.-]/gi, '_'); // Clean up filename

  const tempFileName =
    type === 'audio'
      ? `audio-${videoId}.mp3`
      : `video-${videoId}.mp4`;
  const filePath = path.join(__dirname, tempFileName);

  // Clean up old files
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  ctx.reply('⏳ Downloading... Please wait.');

  try {
    const stream =
      type === 'audio'
        ? ytdl(url, { filter: 'audioonly', quality: 'highestaudio' })
        : ytdl(url, { quality: '18' }); // 18 = 360p mp4

    const file = fs.createWriteStream(filePath);
    stream.pipe(file);

    stream.on('progress', (chunkLength, downloaded, total) => {
      // Optionally send progress updates
      // You can implement progress every X percent or MB
    });

    file.on('finish', async () => {
      if (type === 'audio') {
        await ctx.replyWithAudio({ source: filePath }, { title });
      } else {
        await ctx.replyWithVideo({ source: filePath }, { caption: title });
      }
      fs.unlinkSync(filePath); // Clean up
    });

    stream.on('error', err => {
      ctx.reply('❌ Error downloading the file.');
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  } catch (e) {
    ctx.reply('❌ Something went wrong. Try again.');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(err);
  ctx.reply('❌ Bot error!');
});

bot.launch();
