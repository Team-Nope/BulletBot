import { Guild } from 'discord.js';
import { filterAction, filterActions } from './filters';
import { permLevels } from './permissions';
import { Bot } from '..';

/**
 * Returns similarity value based on Levenshtein distance.
 * The value is between 0 and 1
 *
 * @param {string} s1 first string
 * @param {string} s2 second string
 * @returns
 */
function stringSimilarity(s1: string, s2: string) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

/**
 * helper function for stringSimilarity
 *
 * @param {*} s1
 * @param {*} s2
 * @returns
 */
function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue),
                            costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

/**
 * Parses string into GuildMember object.
 * If the username isn't accurate the function will use the stringSimilarity method.
 * Can parse following inputs:
 * - user mention
 * - username
 * - nickname
 * - user id
 *
 * @export
 * @param {Guild} guild guild where the member is in
 * @param {string} text string to parse
 * @returns
 */
export async function stringToMember(guild: Guild, text: string, bySimilar: boolean = true) {
    if (/<@(\d*)>/g.test(text)) {
        var result = /<@(\d*)>/g.exec(text);
        if (result != null) {
            text = result[1];
        }
    }
    if (/<@!(\d*)>/g.test(text)) {
        var result = /<@!(\d*)>/g.exec(text);
        if (result != null) {
            text = result[1];
        }
    }
    if (/([^#@:]{2,32})#\d{4}/g.test(text)) {
        var result = /([^#@:]{2,32})#\d{4}/g.exec(text);
        if (result != null) {
            text = result[1];
        }
    }
    guild = await guild.fetchMembers()

    // by id
    var member = guild.members.get(text);
    if (!member)
        // by username
        member = guild.members.find(x => x.user.username == text);
    if (!member)
        // by nickname
        member = guild.members.find(x => x.nickname == text);

    if (!member && bySimilar) {
        // closest matching username
        member = guild.members.reduce(function (prev, curr) {
            return (stringSimilarity(curr.user.username, text) > stringSimilarity(prev.user.username, text) ? curr : prev);
        });
        if (stringSimilarity(member.user.username, text) < 0.4) {
            member = undefined;
        }
    }
    return member;
}

/**
 * Parses a string into a Role object or a String for 'everyone' or 'here'.
 * If the role name isn't accurate the function will use the stringSimilarity method.
 * Can parse following input:
 * - here / everyone name
 * - @here / @everyone mention
 * - role name
 * - role mention
 * - role id
 *
 * @export
 * @param {Guild} guild guild where the role is in
 * @param {string} text string to parse
 * @returns
 */
export function stringToRole(guild: Guild, text: string) {

    if (text == 'here' || text == '@here') {
        return '@here';
    }
    if (text == 'everyone' || text == '@everyone') {
        return '@everyone';
    }

    if (/<@&(\d*)>/g.test(text)) {
        var result = /<@&(\d*)>/g.exec(text);
        if (result != null) {
            text = result[1];
        }
    }
    // by id
    var role = guild.roles.get(text);
    if (!role) {
        // by name
        role = guild.roles.find(x => x.name == text);
    }
    if (!role) {
        // closest matching name
        role = guild.roles.reduce(function (prev, curr) {
            return (stringSimilarity(curr.name, text) > stringSimilarity(prev.name, text) ? curr : prev);
        });
        if (stringSimilarity(role.name, text) < 0.4) {
            role = undefined;
        }
    }
    return role;
}

/**
 * Parses a string into a Channel object.
 * Can parse following input:
 * - channel mention
 * - channel id
 *
 * @export
 * @param {Guild} guild guild where channel is in
 * @param {string} text string to parse
 * @returns
 */
export function stringToChannel(guild: Guild, text: string) {
    if (!guild) return null;
    if (/<#(\d*)>/g.test(text)) {
        var result = /<#(\d*)>/g.exec(text);
        if (result != null) {
            text = result[1];
        }
    }
    return guild.channels.get(text);
}

/**
 * Parses a string into a JSON object for Embed.
 *
 * @export
 * @param {string} text string to parse
 * @returns
 */
export function stringToEmbed(text: string) {
    var embed: JSON = null;
    try {
        //text = text.replace(/(\r\n|\n|\r|\t| {2,})/gm, '');
        embed = JSON.parse(text);
    } catch (e) {
        return null;
    }
    return embed
}

/**
 * Converts filter action into words. This function creates partial sentences about what the bot did.
 *
 * @export
 * @param {filterAction} action action to stringify
 * @returns
 */
export function actionToString(action: filterAction) {
    switch (action.type) {
        case filterActions.nothing:
            return 'nothing';
        case filterActions.delete:
            if (action.delay == 0) {
                return 'deleted message';
            }
            return `deleted message after ${action.delay}ms`;
        case filterActions.send:

            return `replied with '${action.message}' to message`;
        default:
            // error will already be logged in executeAction()
            console.warn('actionToString: unknown action');
            return 'unknown action';
    }
}

/**
 * stringifies permission level
 * - 0: member
 * - 1: immune member
 * - 2: mod
 * - 3: admin
 * - 4: my master
 *
 * @export
 * @param {number} permLevel permLevel to stringify
 * @returns
 */
export function permToString(permLevel: number) {
    switch (permLevel) {
        case permLevels.member:
            return 'member';
        case permLevels.immune:
            return 'immune member';
        case permLevels.mod:
            return 'mod';
        case permLevels.admin:
            return 'admin';
        case permLevels.botMaster:
            return 'my master';
        default:
            Bot.mStats.logError(new Error('unknown permission level: ' + permLevel));
            console.warn('unknown permission level: ' + permLevel);
            return 'Unknown PermissionLevel';
    }
}