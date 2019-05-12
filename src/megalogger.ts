import { Channel, GuildChannel, TextChannel, Role, GuildMember, Guild, User } from "discord.js";
import { Bot } from ".";
import { timeFormat, getDurationDiff, getDayDiff } from "./utils/time";
import dateFormat = require('dateformat');

/**
 * megalogger function for logging channel create and channel delete
 *
 * @export
 * @param {GuildChannel} channel deleted/created channel
 * @param {boolean} created true if it was created, false if it was deleted
 * @returns
 */
export async function logChannelToggle(channel: GuildChannel, created: boolean) {
    let megalogDoc = await Bot.database.findMegalogDoc(channel.guild.id);
    if (!megalogDoc) return;
    if (!megalogDoc.channelCreate && created) return;
    if (!megalogDoc.channelDelete && !created) return;
    let logChannel = channel.guild.channels.get(created ? megalogDoc.toObject().channelCreate : megalogDoc.toObject().channelDelete);
    if (!logChannel || !(logChannel instanceof TextChannel)) return;
    logChannel.send({
        "embed": {
            "description": `**Channel ${created ? 'Created' : 'Deleted'}: ${created ? channel.toString() : '#' + channel.name}**`,
            "color": (created ? Bot.database.settingsDB.cache.embedColors.positive : Bot.database.settingsDB.cache.embedColors.negative),
            "timestamp": new Date().toISOString(),
            "footer": {
                "text": "ID: " + channel.id
            },
            "author": {
                "name": channel.guild.name,
                "icon_url": channel.guild.iconURL
            }
        }
    });
    Bot.mStats.logMessageSend();
}

/**
 * megalogger function for logging a channel update
 * currently logs following actions:
 *  - name change
 *  - topic change
 *  - permissions change
 *
 * @export
 * @param {GuildChannel} oldChannel channel before update
 * @param {GuildChannel} newChannel channel after update
 * @returns
 */
export async function logChannelUpdate(oldChannel: GuildChannel, newChannel: GuildChannel) {
    let megalogDoc = await Bot.database.findMegalogDoc(newChannel.guild.id);
    if (!megalogDoc) return;
    if (!megalogDoc.channelUpdate) return;
    let logChannel = newChannel.guild.channels.get(megalogDoc.toObject().channelUpdate);
    if (!logChannel || !(logChannel instanceof TextChannel)) return;
    if (oldChannel.name != newChannel.name) { // name change
        logChannel.send({
            "embed": {
                "description": `**Channel name changed of ${newChannel.toString()}**`,
                "color": Bot.database.settingsDB.cache.embedColors.default,
                "timestamp": new Date().toISOString(),
                "footer": {
                    "text": "ID: " + newChannel.id
                },
                "author": {
                    "name": newChannel.guild.name,
                    "icon_url": newChannel.guild.iconURL
                },
                "fields": [
                    {
                        "name": "Old",
                        "value": oldChannel.name,
                        "inline": true
                    },
                    {
                        "name": "New",
                        "value": newChannel.name,
                        "inline": true
                    }
                ]
            }
        });
        Bot.mStats.logMessageSend();
    } if (oldChannel instanceof TextChannel && newChannel instanceof TextChannel && oldChannel.topic != newChannel.topic) { // topic change
        logChannel.send({
            "embed": {
                "description": `**Channel topic changed of ${newChannel.toString()}**`,
                "color": Bot.database.settingsDB.cache.embedColors.default,
                "timestamp": new Date().toISOString(),
                "footer": {
                    "text": "ID: " + newChannel.id
                },
                "author": {
                    "name": newChannel.guild.name,
                    "icon_url": newChannel.guild.iconURL
                },
                "fields": [
                    {
                        "name": "Old",
                        "value": oldChannel.topic ? oldChannel.topic : '*empty topic*',
                        "inline": true
                    },
                    {
                        "name": "New",
                        "value": newChannel.topic ? newChannel.topic : '*empty topic*',
                        "inline": true
                    }
                ]
            }
        });
        Bot.mStats.logMessageSend();
    }

    // get permission difference between the old and new channel
    let permDiff = oldChannel.permissionOverwrites.filter(x => {
        if (newChannel.permissionOverwrites.find(y => y.allowed.bitfield == x.allowed.bitfield) && newChannel.permissionOverwrites.find(y => y.denied.bitfield == x.denied.bitfield))
            return false;
        return true;
    }).concat(newChannel.permissionOverwrites.filter(x => {
        if (oldChannel.permissionOverwrites.find(y => y.allowed.bitfield == x.allowed.bitfield) && oldChannel.permissionOverwrites.find(y => y.denied.bitfield == x.denied.bitfield))
            return false;
        return true;
    }));
    if (permDiff.size) {
        let embed = { // base embed
            "embed": {
                "description": `**Channel permissions changed of ${newChannel.toString()}**\n*note:* check [docs](https://discordapp.com/developers/docs/topics/permissions) to see what the numbers mean`,
                "color": Bot.database.settingsDB.cache.embedColors.default,
                "timestamp": new Date().toISOString(),
                "footer": {
                    "text": "ID: " + newChannel.id
                },
                "author": {
                    "name": newChannel.guild.name,
                    "icon_url": newChannel.guild.iconURL
                },
                "fields": []
            }
        };
        for (const permID of permDiff.keys()) { // add a field for changed role or member
            let oldPerm: any = oldChannel.permissionOverwrites.get(permID) || {};
            let newPerm: any = newChannel.permissionOverwrites.get(permID) || {};
            let oldBitfields = {
                allowed: oldPerm.allowed ? oldPerm.allowed.bitfield : 0,
                denied: oldPerm.denied ? oldPerm.denied.bitfield : 0
            };
            let newBitfields = {
                allowed: newPerm.allowed ? newPerm.allowed.bitfield : 0,
                denied: newPerm.denied ? newPerm.denied.bitfield : 0
            };

            var role: Role;
            var member: GuildMember;
            if (oldPerm.type == 'role' || newPerm.type == 'role')
                role = newChannel.guild.roles.get(newPerm.id || oldPerm.id);
            if (oldPerm.type == 'member' || newPerm.type == 'member')
                member = await newChannel.guild.fetchMember(newPerm.id || oldPerm.id);

            let value = '';
            if (oldBitfields.allowed !== newBitfields.allowed) {
                value += `Allowed Perms: \`${oldBitfields.allowed}\` to \`${newBitfields.allowed}\`\n`;
            }
            if (oldBitfields.denied !== newBitfields.denied) {
                value += `Denied Perms: \`${oldBitfields.denied}\` to \`${newBitfields.denied}\``;
            }

            embed.embed.fields.push({
                "name": newPerm.type == 'role' ? role.name + ` (ID: ${role.id}):` : member.user.username + ` (ID: ${member.id}):`,
                "value": value
            });
        }
        logChannel.send(embed);
        Bot.mStats.logMessageSend();
    }

}


/**
 * megalogger function that logs a ban or unban
 *
 * @export
 * @param {Guild} guild guild in which someone was un-/banned
 * @param {User} user user that got un-/banned
 * @param {boolean} banned true if someone was banned, false if someone was unbanned
 * @returns
 */
export async function logBan(guild: Guild, user: User, banned: boolean) {
    let megalogDoc = await Bot.database.findMegalogDoc(guild.id);
    if (!megalogDoc) return;
    if ((!megalogDoc.ban && banned) || (!megalogDoc.unban && !banned)) return;
    let logChannel = guild.channels.get(banned ? megalogDoc.toObject().ban : megalogDoc.toObject().unban);
    if (!logChannel || !(logChannel instanceof TextChannel)) return;
    logChannel.send({
        "embed": {
            "description": `${user.toString()}\n${user.tag}`,
            "color": Bot.database.settingsDB.cache.embedColors[banned ? 'negative' : 'positive'],
            "timestamp": new Date().toISOString(),
            "footer": {
                "text": "ID: " + user.id
            },
            "thumbnail": {
                "url": user.avatarURL
            },
            "author": {
                "name": "User " + (banned ? 'Banned' : 'Unbanned'),
                "icon_url": user.avatarURL
            }
        }
    });
    Bot.mStats.logMessageReceived();
}

/**
 * megalogger function that logs a member join or leave
 *
 * @export
 * @param {GuildMember} member member that joined or left
 * @param {boolean} joined true if member joined, false if member left
 * @returns
 */
export async function logMember(member: GuildMember, joined: boolean) {
    let megalogDoc = await Bot.database.findMegalogDoc(member.guild.id);
    if (!megalogDoc) return;
    if ((!megalogDoc.memberJoin && joined) || (!megalogDoc.memberLeave && !joined)) return;
    let logChannel = member.guild.channels.get(joined ? megalogDoc.toObject().memberJoin : megalogDoc.toObject().memberLeave);
    if (!logChannel || !(logChannel instanceof TextChannel)) return;
    let embed: any = {
        "embed": {
            "description": member.toString() + "\n" + member.user.tag,
            "color": Bot.database.settingsDB.cache.embedColors[joined ? 'positive' : 'negative'],
            "timestamp": joined ? member.joinedAt.toISOString() : new Date().toISOString(),
            "footer": {
                "text": "ID: " + member.id
            },
            "thumbnail": {
                "url": member.user.avatarURL
            },
            "author": {
                "name": "User " + (joined ? 'Joined' : 'Left'),
                "icon_url": member.user.avatarURL
            }
        }
    };
    if (!joined) {
        embed.embed.fields = [{
            "name": "Joined At",
            "value": dateFormat(member.joinedAt, timeFormat) + ` (${getDayDiff(member.joinedTimestamp, Date.now())} days ago)`
        }];
    }
    logChannel.send(embed);
    Bot.mStats.logMessageReceived();
}

/**
 * megalogger function that logs a nickname change. It checks if the nickname has changed, so you don't have to
 *
 * @export
 * @param {GuildMember} oldMember member before change
 * @param {GuildMember} newMember member after change
 * @returns
 */
export async function logNickname(oldMember: GuildMember, newMember: GuildMember) {
    if (oldMember.nickname == newMember.nickname) return;
    let megalogDoc = await Bot.database.findMegalogDoc(newMember.guild.id);
    if (!megalogDoc) return;
    if (!megalogDoc.nicknameChange) return;
    let logChannel = newMember.guild.channels.get(megalogDoc.nicknameChange);
    if (!logChannel || !(logChannel instanceof TextChannel)) return;
    logChannel.send({
        "embed": {
            "description": `**${newMember.toString()} nickname changed**`,
            "color": Bot.database.settingsDB.cache.embedColors.default,
            "timestamp": new Date().toISOString(),
            "footer": {
                "text": "ID: " + newMember.id
            },
            "author": {
                "name": newMember.user.tag,
                "icon_url": newMember.user.avatarURL
            },
            "fields": [
                {
                    "name": "Before",
                    "value": oldMember.nickname ? oldMember.nickname : '*None*',
                    "inline": true
                },
                {
                    "name": "After",
                    "value": newMember.nickname ? newMember.nickname : '*None*',
                    "inline": true
                }
            ]
        }
    });
    Bot.mStats.logMessageReceived();
}