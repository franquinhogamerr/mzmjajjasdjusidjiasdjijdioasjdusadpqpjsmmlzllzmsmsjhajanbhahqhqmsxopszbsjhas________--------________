const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const cron = require('node-cron');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.TOKEN;

// Load shift data from a JSON file
function loadShifts() {
    try {
        return JSON.parse(fs.readFileSync('shifts.json'));
    } catch (err) {
        return {};
    }
}

// Save shift data to a JSON file
function saveShifts(shifts) {
    fs.writeFileSync('shifts.json', JSON.stringify(shifts, null, 4));
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    scheduleNotifications();
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).split(' ');
    const command = args.shift().toLowerCase();

    if (command === 'addshift') {
        const user = message.mentions.users.first();
        const date = args[0];
        const time = args[1];

        if (!user || !date || !time) {
            return message.reply('Usage: !addshift @user YYYY-MM-DD HH:MM');
        }

        const shifts = loadShifts();
        if (!shifts[user.id]) {
            shifts[user.id] = [];
        }

        const shiftTime = new Date(`${date}T${time}:00.000Z`);
        shifts[user.id].push(shiftTime.toISOString());
        saveShifts(shifts);

        message.reply(`Shift added for ${user.tag} on ${date} at ${time}.`);
    }

    if (command === 'removeshift') {
        const user = message.mentions.users.first();
        const date = args[0];
        const time = args[1];

        if (!user || !date || !time) {
            return message.reply('Usage: !removeshift @user YYYY-MM-DD HH:MM');
        }

        const shifts = loadShifts();
        const shiftTime = new Date(`${date}T${time}:00.000Z`).toISOString();

        if (shifts[user.id]) {
            const index = shifts[user.id].indexOf(shiftTime);
            if (index > -1) {
                shifts[user.id].splice(index, 1);
                saveShifts(shifts);
                message.reply(`Shift removed for ${user.tag} on ${date} at ${time}.`);
            } else {
                message.reply(`No such shift found for ${user.tag}.`);
            }
        } else {
            message.reply(`No shifts found for ${user.tag}.`);
        }
    }

    if (command === 'listshifts') {
        const user = message.mentions.users.first();

        if (!user) {
            return message.reply('Usage: !listshifts @user');
        }

        const shifts = loadShifts();

        if (shifts[user.id] && shifts[user.id].length > 0) {
            const shiftList = shifts[user.id].map(shift => new Date(shift).toUTCString()).join('\n');
            message.reply(`Shifts for ${user.tag}:\n${shiftList}`);
        } else {
            message.reply(`No shifts found for ${user.tag}.`);
        }
    }
});

// Schedule notifications for upcoming shifts
function scheduleNotifications() {
    cron.schedule('* * * * *', () => {
        const shifts = loadShifts();
        const now = new Date();

        for (const userId in shifts) {
            const userShifts = shifts[userId];
            for (const shift of userShifts) {
                const shiftTime = new Date(shift);
                if (now.getTime() + 30 * 60 * 1000 >= shiftTime.getTime() && shiftTime > now) {
                    client.users.fetch(userId).then(user => {
                        user.send(`Reminder: You have a shift coming up at ${shiftTime.toUTCString()}.`);
                    }).catch(err => {
                        console.error(`Failed to fetch user ${userId} for shift reminder:`, err);
                    });
                }
            }
        }
    });
}

client.login(TOKEN);