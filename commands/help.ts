import { BOTMASTER, MEMBER } from "../utils/permissions";
import { bot } from "..";
import utils from "../utils";
import { Message, RichEmbed } from "discord.js";
import { command as commandInterface } from "../commands";

function sendCommandList(bot: bot, message: Message, strucObject: any, path:string) {
    var output = new RichEmbed();
    output.setAuthor("Command List:", bot.client.user.avatarURL);
    if(path) output.setFooter("Path: ~"+path);
    output.setColor(bot.database.getGlobalSettings().helpEmbedColor);
    var categories = Object.keys(strucObject).filter(x => typeof (strucObject[x].embedHelp) === "undefined");
    if (categories.length != 0) {
        var cat_text = categories[0];
        for (i = 1; i < categories.length; i++) {
            cat_text += "\n" + categories[i]
        }
        output.addField("Subcategories:", cat_text);
    }

    var commands = Object.keys(strucObject).filter(x => typeof (strucObject[x].embedHelp) != "undefined");
    for (var i = 0; i < commands.length; i++) {
        var f = bot.commands.get(commands[i]);
        if(f.permissionLevel == BOTMASTER) continue;
        output.addField(bot.database.getPrefix() + f.name, f.shortHelp);
    }

    message.channel.send(output);
    bot.mStatistics.logCommandUsage(command.name,"commandList");
}

var command: commandInterface = { name: null, path: null,dm:null, permissionLevel: null, shortHelp: null, embedHelp: null, run: null };


command.run = async (bot: bot, message: Message, args: string, permissionLevel: number) => {
    try {
        if (args.length == 0) {
            sendCommandList(bot, message, bot.commands.structure, null);
            return;
        }
        var command = bot.commands.get(args.toLowerCase());
        if (command == null) {
            if (typeof (bot.commands.structure[args.split("/")[0]]) != "undefined") {
                var strucObject = bot.commands.structure;
                var keys = args.split("/");
                for (var i = 0; i < keys.length; i++) {
                    if (typeof (strucObject[keys[i]]) === "undefined") {
                        message.channel.send("Couldn't find '" + args + "' category");
                        return;
                    } else {
                        strucObject = strucObject[keys[i]];
                    }
                }
                sendCommandList(bot, message, strucObject,args);
                return;
            } else {
                message.channel.send("Couldn't find '" + args.toLowerCase() + "' command");
                return;
            }
        }
        bot.mStatistics.logCommandUsage("help","commandHelp");
        message.channel.send(command.embedHelp(bot));
    } catch (e) {
        bot.error(message, e);
    }
}

command.name = "help";
command.path = "";
command.dm = true;
command.permissionLevel = MEMBER;
command.shortHelp = "Gives a command list";
command.embedHelp = function (bot: bot) {
    return {
        "embed": {
            "color": bot.database.getGlobalSettings().helpEmbedColor,
            "author": {
                "name": "Command: " + bot.database.getPrefix() + command.name
            },
            "fields": [
                {
                    "name": "Description:",
                    "value": "lists all commands/categories and can get detailed help for command"
                },
                {
                    "name": "Need to be:",
                    "value": utils.permissions.permToString(command.permissionLevel),
                    "inline": true
                },
                {
                    "name": "DM capable:",
                    "value": command.dm,
                    "inline": true
                },
                {
                    "name": "Usage:",
                    "value": "{command}\n{command} [command name/category]\nuse `category/subcategory` to get list from subcategory".replace(/\{command\}/g, bot.database.getPrefix() + command.name)
                },
                {
                    "name": "Example:",
                    "value": "{command}\n{command} mention".replace(/\{command\}/g, bot.database.getPrefix() + command.name)
                }
            ]
        }
    }
};

export default command;