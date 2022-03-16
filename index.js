const { Client } = require('discord.js')
const { nSysManager } = require('nsyslava');
const axios = require('axios');

const config =  {
    TOKEN: 'YOUR_BOT_TOKEN',
    PREFIX: '!',
    ADMIN_IDS: ['635750674604359690']
}

const manager = new nSysManager([
    {
        name: 'nLavalink',
        host: 'localhost',
        port: 2333,
        secure: false,
        authorization: '@64promiseall',
        clientName: 'nSysLava',
        reconnect: {
            retryAmout: 999,
            delay: 3000,
        },
        search: true,
        play: true,
    }
])

manager.on('nodeConnect', node => console.log(`[nSysLava] Node "${node.name}" Connected!`));
manager.on('nodeDisconnect', node => console.log(`[nSysLava] Node "${node.name}" Disconnected!`));
manager.on('nodeReconnecting', (node, retryAmout) => console.log(`[nSysLava] Node "${node.name}" Reconnecing.. ${retryAmout.toLocaleString()}`))
manager.on('nodeReconnectingFull', node => console.log(`[nSysLava] Node "${node.name}" offline.`));

const client = new Client({ intents: 32767 });

client.ws.on('VOICE_SERVER_UPDATE', upd => manager.handleVoiceUpdate(upd))
client.ws.on('VOICE_STATE_UPDATE', upd => manager.handleVoiceUpdate(upd))

manager.on('sendGatewayPayload', (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
});

client.login(config.TOKEN);

client.once('ready', () => {
    console.log(`[Client] is Ready! | Login as ${client.user.tag}`)
    manager.connect(client.user.id)
})

client.on('messageCreate', message => {
    if (message.author.bot || !message.content.startsWith(config.PREFIX)) return;
    const args = message.content.substring(config.PREFIX.length).split(' ');
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName) || Array.from(client.commands.values()).find(_ => _.aliases?.includes(commandName));
    if (!command || (command?.admin && !config.ADMIN_IDS.includes(message.author.id))) return;
    command.run(message, args);
});

function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
        
    hours = (hours < 10) ? "0" + hours : hours
    minutes = (minutes < 10) ? "0" + minutes : minutes
    seconds = (seconds < 10) ? "0" + seconds : seconds
        
    return hours + ":" + minutes + ":" + seconds
}

function generateEmbed(tracks, start) {
    if (!Array.isArray(tracks)) tracks = [ tracks ];
    const current = tracks.slice(start, start + 10);
    return {
        type: 'rich',
        description: `ทั้งหมด ${tracks.length.toLocaleString()} เพลง`,
        fields: current.map((item, index) => ({
            name: `**${(index + start + 1).toLocaleString()})** ${item.info.title}`,
            value: `*${item.info.isStream ? 'Stream' : msToTime(item.info.length)}* | ${item.info.author}`
        })),
        ...(tracks.length > 10 ? { footer: { text: `นี่คือหน้าที่ ${((start / 10) + 1).toLocaleString()} จากทั้งหมด ${Math.ceil(tracks.length / 10).toLocaleString()} หน้า` } } : {}),
        color: 'AQUA'
    }
};

function isNumeric(str) {
    if (typeof str != "string") return false
    return !isNaN(str) && !isNaN(parseFloat(str))
}

function uptimeCalculate(uptime) {
    let uptime_seconds = uptime % 60,
        uptime_minutes = Math.floor(uptime / 60) % 60,
        uptime_hours = Math.floor(uptime / 3600) % 24,
        uptime_days = Math.floor(uptime / 86400)
    return `${uptime_days} Days ${uptime_hours} Hours ${uptime_minutes} Minutes and ${uptime_seconds.toFixed()} Seconds`
}

const button = {
    back: {
        type: 'BUTTON',
        label: 'ก่อนหน้า',
        customId: 'back',
        emoji: { name: '⬅️' },
        style: 'SECONDARY'
    },
    forward: {
        type: 'BUTTON',
        label: 'หน้าถัดไป',
        customId: 'forward',
        emoji: { name: '➡️' },
        style: 'SECONDARY'
    }
}

const commands = [
    {
        name: 'join',
        aliases: ['connect'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        run(message, args) {
            const { channel } = message.member.voice
            if (!channel) return message.reply('❌ ไม่พบช่องเสียงที่คุณอยู่ค่ะ')
            let player = manager.getPlayer(message.guildId);
            if (!player) {
                player = manager.createPlater(message.guildId);
                player.connect(channel.id);
            } else if (player.channelId !== channel.id) {
                const playerChannel = message.guild.channels.cache.get(player.channelId);
                if (player.isPlaying && playerChannel?.members?.size > 1) return message.reply([
                    '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                    `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}>`
                ].join('\n'));
                player.connect(channel.id);
            };
            message.reply(`✅ เชื่อมต่อไปยังช่องเสียง "${channel.name}" เรียบร้อยค่ะ!`);
        }
    },
    {
        name: 'disconnect',
        aliases: ['dis', 'leave'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            manager.destroyPlayer(player.guildId);
            message.reply(`✅ ตัดการเชื่อมต่อจากช่องเสียง "${message.member.voice.channel.name}" เรียบร้อยค่ะ!`);
        }
    },
    {
        name: 'play',
        aliases: ['p'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const { channel } = message.member.voice
            if (!channel) return message.reply('❌ ไม่พบช่องเสียงที่คุณอยู่ค่ะ')
            let player = manager.getPlayer(message.guildId);
            if (!player) {
                player = manager.createPlater(message.guildId);
                if (!player) return message.reply('❌ ไม่สามารถสร้างตัวเล่นเพลงได้')
                player.connect(channel.id);
                message.channel.send(`✅ เชื่อมต่อไปยังช่องเสียง "${channel.name}" เรียบร้อยค่ะ!`).then(m => setTimeout(() => m.delete(), 3000)).catch(() => {});
            } else if (player.channelId !== channel.id) {
                const playerChannel = message.guild.channels.cache.get(player.channelId);
                if (player.isPlaying && playerChannel?.members?.size > 1) return message.reply([
                    '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                    `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
                ].join('\n'));
                player.connect(channel.id);
            };
            const res = await manager.loadTracks(args.join(' ')).catch(e => ({ loadType: 'LOAD_FAILED' }));
            if (res.loadType === 'LOAD_FAILED' || res.loadType === 'NO_MATCHES') return message.reply(`❌ ไม่พบผลการค้นหาของเพลงที่คุณขอมาค่ะ`);
            if (res.loadType === 'SEARCH_RESULT' || res.loadType === 'TRACK_LOADED') res.tracks = [ res.tracks[0] ];
            player.queue.add(res.tracks);
            if (!player.isPlaying && !player.isPaused) player.queue.start();
            const msg = await message.reply({
                embeds: [ generateEmbed(res.tracks, 0) ],
                components: res.tracks.length <= 10 ? [] : [
                    {
                        type: 'ACTION_ROW',
                        components: [ button.forward ]
                    }
                ]
            })
            if (res.tracks.length <= 10) return;
            let currentIndex = 0;
            msg.createMessageComponentCollector({
                filter: ({ user }) => user.id === message.author.id, time: 30 * 60000, 
            }).on('collect', interaction => {
                interaction.customId === 'back' ? (currentIndex -= 10) : (currentIndex += 10)
                interaction.update({
                    embeds: [ generateEmbed(res.tracks, currentIndex) ],
                    components: [
                        {
                            type: 'ACTION_ROW',
                            components: [
                                ...(currentIndex ? [ button.back ] : []),
                                ...(currentIndex + 10 < res.tracks.length ? [ button.forward ] : [])
                            ]
                        }
                    ]
                })
            })
        }
    },
    {
        name: 'queue',
        aliases: ['q'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (!player.queue.tracks.length) return message.reply(`❌ ขณะนี้ไม่มีเพลงในคิวเลยค่ะ`);
            const msg = await message.reply({
                embeds: [ generateEmbed(player.queue.tracks, 0) ],
                components: player.queue.tracks.length <= 10 ? [] : [
                    {
                        type: 'ACTION_ROW',
                        components: [ button.forward ]
                    }
                ]
            })
            if (player.queue.tracks.length <= 10) return;
            let currentIndex = 0;
            msg.createMessageComponentCollector({
                filter: ({ user }) => user.id === message.author.id, time: 30 * 60000, 
            }).on('collect', interaction => {
                interaction.customId === 'back' ? (currentIndex -= 10) : (currentIndex += 10)
                interaction.update({
                    embeds: [ generateEmbed(player.queue.tracks, currentIndex) ],
                    components: [
                        {
                            type: 'ACTION_ROW',
                            components: [
                                ...(currentIndex ? [ button.back ] : []),
                                ...(currentIndex + 10 < player.queue.tracks.length ? [ button.forward ] : [])
                            ]
                        }   
                    ]
                })
            })
        }
    },
    {
        name: 'skip',
        aliases: ['next'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!player.queue.tracks.length && !player.queue.isAutoplay) return message.reply(`❌ ขณะนี้ไม่มีเพลงในคิวเลยค่ะ`);
            await player.queue.skip();
            message.reply('✅ กำลังเล่นเพลงถัดไปในคิวค่ะ!')
        }
    },
    {
        name: 'skipto',
        aliases: ['nextto'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!isNumeric(args[0])) return message.reply('❌ ตำแหน่งของเพลงไม่ถูกต้องค่ะ');
            const index = parseInt(args[0]);
            if (index - 1 > player.queue.tracks.length) return message.reply('❌ ตำแหน่งของเพลงไม่ถูกต้องค่ะ');
            player.queue.skipTo(index);
            message.reply(`✅ ข้ามไปเล่นเพลงที่ ${index.toLocaleString()} เรียบร้อยค่ะ!`)
        }
    },
    {
        name: 'previous',
        aliases: ['prev'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!player.queue.previous.length) return message.reply(`❌ ขณะนี้ไม่มีเพลงในคิวเลยค่ะ`);
            await player.queue.toPrevious();
            message.reply('✅ กำลังเล่นเพลงก่อนหน้าในคิวค่ะ!')
        }
    },
    {
        name: 'remove',
        aliases: ['delete'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!isNumeric(args[0])) return message.reply('❌ ตำแหน่งของเพลงไม่ถูกต้องค่ะ');
            const index = parseInt(args[0]);
            if (index - 1 > player.queue.tracks.length) return message.reply('❌ ตำแหน่งของเพลงไม่ถูกต้องค่ะ');
            player.queue.remove(index);
            message.reply(`✅ ลบเพลงที่ ${index.toLocaleString()} ออกจากคิวเรียบร้อยค่ะ!`)
        }
    },
    {
        name: 'pause',
        aliases: ['stop'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (player.isPaused) return message.reply(`❌ ขณะนี้ได้พักการเล่นเพลงอยู่แล้วค่ะ`);
            await player.setPause(true);
            message.reply('✅ พักการเล่นเพลงเรียบร้อยค่ะ!')
        }
    },
    {
        name: 'resume',
        aliases: ['continue'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!player.isPaused) return message.reply(`❌ ขณะนี้ได้ไม่ได้พักการเล่นอยู่ค่ะ`);
            await player.setPause(true);
            message.reply('✅ เล่นเพลงต่อเรียบร้อยค่ะ!')
        }
    },
    {
        name: 'volume',
        aliases: ['vol'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!isNumeric(args[0])) return message.reply(`❌ ระดับเสียงไม่ถูกต้องค่ะ`);
            const volume = parseInt(args[0]);
            if (volume < 0 || volume > 150) return message.reply(`❌ ไม่สามารถตั้งค่าระดับเสียงได้มากว่า 150 หรือต่ำกว่า 0 ค่ะ`);
            await player.setVolume(volume);
            message.reply(`✅ ตั้งค่าระดับเสียงเป็น \`${volume}\` เรียบร้อยค่ะ!`)
        }
    },
    {
        name: 'seek',
        aliases: ['sk'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!player.queue.current) return message.reply(`❌ ขณะนี้บอทไม่ได้เล่นเพลงอยู่ค่ะ`);
            if (!args[0]?.match(/^[0-5]?[0-9](:[0-5][0-9]){1,2}$/)) return message.reply(`❌ ตำแหน่งที่ต้องการจะกรอไม่ถูกต้องค่ะ`);
            const duration = args[0].split(":").map(Number).reduce((acc, curr) => curr + acc * 60) * 1000
            await player.seek(duration);
            message.reply(`✅ ข้ามเพลงไปยังนาที่ที่ \`${args[0]}\` เรียบร้อยค่ะ!`)
        }
    },
    {
        name: 'loop',
        aliases: ['l'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (args[0] && !['none','queue','track'].includes(args[0])) return message.reply('❌ โหมดการ Loop ไม่ถูกต้องค่ะ ( none / queue / track )');
            switch (args[0]) {
                case 'none':
                    player.queue.setLoop(0)
                    break;
                case 'queue':
                    player.queue.setLoop(1)
                    break;
                case 'track':
                    player.queue.setLoop(2)
                    break;
                default:
                    player.queue.setLoop(0)
                    break;
            }
            message.reply(`✅ ปรับโหมดการลูปเป็น ${args[0] ? args[0] : 'none'} เรียบร้อยค่ะ!`)
        }
    },
    {
        name: 'autoplay',
        aliases: ['random'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (player.queue.isAutoplay) player.queue.setAutoplay(false);
            else player.queue.setAutoplay();
            message.reply(`✅ ปรับโหมด Autoplay เป็น \`${player.queue.isAutoplay ? 'true' : 'false'}\`เรียบร้อยค่ะ!`)
        }
    },
    {
        name: 'shuffle',
        aliases: ['sf'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        run(message, args) {
            const player = manager.getPlayer(message.guildId);
            if (!player) return message.reply(`❌ ขณะนี้บอทไม่ได้เชื่อมต่อช่องเสียงอยู่ค่ะ`);
            if (player.channelId !== message.member.voice?.channelId) return message.reply([
                '❌ ดูเหมือนตอนนี้บอทจะไม่ได้เชื่อมต่อช่องเสียงของคุณอยู่นะ',
                `ขณะนี้มีคนใช้บอทอยู่ที่ช่องเสียง <#${player.channelId}> ค่ะ`
            ].join('\n'));
            if (!player.queue.tracks.length) return message.reply(`❌ ขณะนี้ไม่มีเพลงในคิวเลยค่ะ`);
            player.queue.shuffle();
            message.reply('✅ สับเพลงในคิวเรียบร้อยค่ะ!');
        }
    },
    {
        name: 'stats',
        aliases: ['status', 'node'],
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            if (!Array.from(manager.nodes.values()).length) return message.reply(`❌ ขณะนี้ไม่มี Node ของบอทค่ะ`);
            function _generateEmbed(index) {
                const current = Array.from(manager.nodes.values()).at(index);
                return {
                    type: 'rich',
                    author: { name: `📘 Node "${current.name}" stats` },
                    description: [
                        `**Connected** ${current.isConnected ? '🟢 true' : '⚪ false'}`,
                        `**Players** ${current.stats.players.toLocaleString()} players`,
                        `**Playing** ${current.stats.playingPlayers.toLocaleString()} players`,
                        `**Ram** ${(current.stats.memory.used / 1024 / 1024).toLocaleString()} / ${(current.stats.memory.allocated / 1024 / 1024).toLocaleString()} MB`,
                        `**CPU** ${(current.stats.cpu.lavalinkLoad * 10).toFixed(2)}%`,
                        `**Uptime** ${uptimeCalculate(current.stats.uptime / 1000)}`
                    ].join('\n'),
                    color: 'AQUA'
                }
            }
            const msg = await message.reply({
                embeds: [ _generateEmbed(0) ],
                components: Array.from(manager.nodes.values()).length <= 1 ? [] : [
                    {
                        type: 'ACTION_ROW',
                        components: [ button.forward ]
                    }
                ]
            })
            if (Array.from(manager.nodes.values()).length <= 1) return;
            let currentIndex = 0;
            msg.createMessageComponentCollector({
                filter: ({ user }) => user.id === message.author.id, time: 30 * 60000, 
            }).on('collect', interaction => {
                interaction.customId === 'back' ? (currentIndex -= 1) : (currentIndex += 1)
                interaction.update({
                    embeds: [ _generateEmbed(currentIndex) ],
                    components: [
                        {
                            type: 'ACTION_ROW',
                            components: [
                                ...(currentIndex ? [ button.back ] : []),
                                ...(currentIndex + 1 < Array.from(manager.nodes.values()).length ? [ button.forward ] : [])
                            ]
                        }   
                    ]
                })
            })
        }
    },
    {
        name: 'add-node',
        aliases: ['addnode'],
        admin: true,
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        async run(message, args) {
            const wsUrlRegex = /^(wss?:\/\/)([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/
            const required = [
                {
                    name: 'websocketUrl',
                    description: 'Lavalink URL WebSocket',
                    check: input => input.match(wsUrlRegex),
                    error: 'invalid websocket url.',
                    example: ['ws://localhost:2333'],
                    required: true
                },
                {
                    name: 'authorization',
                    description: 'Lavalink authorization',
                    check: input => input.length > 8,
                    error: 'password to short.',
                    example: ['youshallnotpass'],
                    required: true
                },
                {
                    name: 'name',
                    description: 'Name for manager to call Lavalink node',
                    check: input => input.length,
                    error: 'invalid name.',
                    example: ['nLavalink']
                },
                {
                    name: 'clientName',
                    description: 'Name of client for connect Lavalink',
                    check: input => input.length,
                    error: 'invalid clientName.',
                    example: ['nSysLava']
                },
                {
                    name: 'reconnect',
                    description: 'settings for Reconnecting | ( retry: number / delay: ms )',
                    check: input => input.includes('/'),
                    error: 'invalid format.',
                    example: ['999/1000']
                },
                {
                    name: 'permission',
                    description: 'permissions for node | ( search: boolean / play: boolean )',
                    check: input => ['true','false'].some(_ => input.startsWith(_) || input.endsWith(_)) && input.includes('/'),
                    error: 'invalid format.',
                    example: ['true/true']
                }
            ];

            const data = {};
            let isApplied = false;
            let isConnected = false;
            function generateMessage(_data, step) {
                return {
                    embeds: [
                        {
                            type: 'rich',
                            ...(!isConnected ? { author: { name: required[step] ? 'โปรดระบุข้อมูลของ Node ที่ต้องการจะเพิ่ม' : (!isApplied ? 'ข้อมูลครบแล้วนี่นา กด Apply เลยสิ!' : 'Node ได้ถูกเพิ่มแล้ว กด Connect เลยสิ!') } } : {}),
                            ...(required[step] && !isApplied ? { title: required[step].name } : {}),
                            description: [
                                ...(required[step] ? [
                                    required[step].description,
                                    `เช่น \`${required[step].example.join(', ')}\``,
                                ] : []),
                                ...(Object.keys(data).length && !isConnected ? ['-------------------------'] : []),
                                ...Object.entries(data).map(([key, value]) => `**${key}:** ${value}`)
                            ].join('\n'),
                            color: 'AQUA'
                        }
                    ],
                    ...(!required.filter(_ => _.required).map(_ => _.name).every(key => Object.keys(data).includes(key)) ? {} : {
                        components: [
                            {
                                type: 'ACTION_ROW',
                                components: [
                                    {
                                        type: 'BUTTON',
                                        customId: 'yes',
                                        label: 'Apply',
                                        emoji: { name: '👍' },
                                        style: 'SUCCESS'
                                    }
                                ]
                            }
                        ]
                    })
                }
            }

            const msg = await message.reply(generateMessage(data, 0));

            msg.createMessageComponentCollector({
                filter: ({ user }) => user.id === message.author.id, time: 300000
            }).on('collect', async interaction => {
                let _m
                if (!isApplied) isApplied = true;
                interaction.deferUpdate();
                if (interaction.customId === 'connect') {
                    const host = wsUrlRegex.exec(data.websocketUrl);
                    const nodeConfig = {
                        name: data.name ?? host[2],
                        host: host[2],
                        port: host[3],
                        secure: data.websocketUrl.startsWith('wss'),
                        authorization: data.authorization,
                        clientName: data.name ?? 'nSysLava',
                        reconnect: data.reconnect ? {
                            retryAmout: Number(data.reconnect.split('/').at(0)),
                            delay: Number(data.reconnect.split('/').at(1))
                        } : {},
                        search: data.permission?.split('/')?.at(0) === 'true' ? true : data.permission?.split('/')?.at(0) === 'false' ? false : undefined,
                        play: data.permission?.split('/')?.at(1) === 'true' ? true : data.permission?.split('/')?.at(1) === 'false' ? false : undefined,
                    }
                    const node = manager.addNode(nodeConfig);
                    await node.connect(client.user.id);
                    isConnected = true;
                    _m = generateMessage(data);
                    _m.content = '✅ Connect Node เรียบร้อยค่ะ!'
                    _m.components = [];
                    return msg.edit(_m);
                }
                _m = generateMessage(data);
                _m.content = '🏓 กำลังทดสอบการปิง..'
                await msg.edit(_m);
                const code = await axios.get(`http${data.websocketUrl.substring(2)}`, {
                    headers: { authorization: data.authorization }
                }).then(_ => _?.status?.code).catch(e => e.response?.status);
                if (code !== 400) return msg.edit({ content: '❌ ไม่สามารถปิง Node ได้', components: [] });
                await msg.edit({ content: '✅ เพิ่ม Node เรียบร้อย!', components: [
                    {
                        type: 'ACTION_ROW',
                        components: [
                            {
                                type: 'BUTTON',
                                customId: 'connect',
                                label: 'Connect',
                                emoji: { name: '✅' },
                                style: 'SUCCESS'
                            }
                        ]
                    }
                ] });
            })

            for (let i = 0; i < required.length; i++) {
                if (isApplied) break;
                const m = await message.channel.awaitMessages({
                    filter: ({ author }) => author.id === message.author.id, max: 1, time: 60000, errors: ['time']
                }).then(_ => _?.at(0)).catch(() => {});
                if (!m?.content) return; // time out
                if (!required[i].check(m.content)) {
                    const _m = await message.reply([`❌ ${required[i].error}`, 'โปรดลองใหม่อีกครั้งนะคะ'].join('\n'));
                    setTimeout(() => {
                        m.delete();
                        _m.delete();
                    }, 3000)
                    i--
                } else {
                    data[required[i].name] = m.content;
                    await m.delete();
                    await msg.edit(generateMessage(data, i + 1));
                };
            };
        }
    },
    {
        name: 'delete-node',
        aliases: ['deletenode', 'delnode', 'rmnode'],
        admin: true,
        /**
         * @param { import('discord.js').Message } message 
         * @param { string[] } args 
         */
        run(message, args) {
            if (!args[0]) return message.reply('❌ โปรดระบุชื่อของ Node ที่ต้องการจะลบด้วยนะคะ')
            const node = manager.getNode(args[0]);
            if (!node) return message.reply(`❌ ไม่พบ Node "${node.name}" ค่ะ`)
            node.disconnect();
            manager.deleteNode(node.name);
            message.reply(`✅ ลบ Node "${node.name}" เรียบร้อยค่ะ!`)
        }
    }
];

client.commands = new Map(commands.filter(_ => _.name.length > 0).map(_ => [_.name, _]));