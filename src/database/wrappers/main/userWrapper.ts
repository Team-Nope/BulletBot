import { User } from 'discord.js';
import { Model } from 'mongoose';
import { keys } from 'ts-transformer-keys';

import { CommandName } from '../../../commands';
import { CommandUsageLimits, ExDocument } from '../../schemas/global';
import { CommandScope, UserObject, UserDoc } from '../../schemas/main/user';
import { DocWrapper } from '../docWrapper';

/**
 * Wrapper for the user object and document so everything can easily be access through one object
 *
 * @export
 * @class UserWrapper
 * @extends {DocWrapper<UserObject>}
 * @implements {userObject}
 */
export class UserWrapper extends DocWrapper<UserObject> implements UserObject {
    /**
     * User object from Discord.js
     *
     * @type {User}
     * @memberof UserWrapper
     */
    user: User;
    /**
     * ID of the user
     *
     * @type {string}
     * @memberof UserWrapper
     */
    readonly id: string;
    /**
     * When the user last used a command in what scope
     *
     * @type {{ [key: string]: { [key: string]: number; }; }}
     * @memberof UserWrapper
     */
    readonly commandLastUsed: { [key: string]: { [key: string]: number; }; };

    /**
     * Creates an instance of UserWrapper.
     * 
     * @param {Model<UserDoc>} model Model for users collection
     * @param {User} user User to wrap
     * @memberof UserWrapper
     */
    constructor(model: Model<UserDoc>, user: User) {
        super(model, { id: user.id }, { id: user.id }, keys<UserObject>());
        this.user = user;
    }

    /**
     * Check if scope is valid
     *
     * @private
     * @param {string} scope
     * @memberof UserWrapper
     */
    private checkCommandScope(scope: string) {
        if (isNaN(Number(scope)) && scope != 'dm' && scope != 'global')
            throw new Error("Scope should be guild id, 'dm' or 'global' but is '" + scope + "'");
    }

    /**
     * returns when the command was last used by the user. returns 0 if it never was used before
     *
     * @param {CommandScope} scope guild id / 'dm' / 'global'
     * @param {string} command command name
     * @returns timestamp when the command was last used by the user
     * @memberof UserWrapper
     */
    async getCommandLastUsed(scope: string, command: CommandName) {
        await this.load('commandLastUsed');
        this.checkCommandScope(scope);
        if (!this.commandLastUsed || !this.commandLastUsed[scope] || !this.commandLastUsed[scope][command])
            return 0;
        return this.commandLastUsed[scope][command];
    }

    /**
     * Sets when the user last used the command. always also sets in global scope
     *
     * @param {CommandScope} scope Guild id / 'dm' / 'global'
     * @param {string} command Name of the command
     * @param {number} timestamp When the command was last used
     * @returns The timestamp if it was successfully set
     * @memberof UserWrapper
     */
    async setCommandLastUsed(scope: CommandScope, command: CommandName, timestamp: number) {
        await this.load('commandLastUsed');
        this.checkCommandScope(scope);
        let query = { $set: {} };
        query.$set[`commandLastUsed.${scope}.${command}`] = timestamp;
        if (scope !== 'global')
            query.$set[`commandLastUsed.global.${command}`] = timestamp;
        await this.update(query);
        let tempData = this.cloneData();
        this._setCommandLastUsed(tempData, scope, command, timestamp);
        this._setCommandLastUsed(tempData, 'global', command, timestamp);
        this.data.next(tempData);
        return timestamp;
    }

    /**
     * Private helper function that only sets the local values
     *
     * @private
     * @param {Partial<UserObject>} data UserObject that should be manipulated
     * @param {CommandScope} scope Guild id / 'dm' / 'global'
     * @param {string} command Name of the command
     * @param {number} timestamp When the command was last used
     * @memberof UserWrapper
     */
    private _setCommandLastUsed(data: Partial<UserObject>, scope: CommandScope, command: CommandName, timestamp: number) {
        if (!data.commandLastUsed[scope]) data.commandLastUsed[scope] = {};
        data.commandLastUsed[scope][command] = timestamp;
    }

    /**
     * Deletes all command last used infos of a specific scope.
     *
     * @param {CommandScope} scope What scope to delete
     * @returns The deleted scope if it was deleted
     * @memberof UserWrapper
     */
    async resetCommandLastUsed(scope: CommandScope) {
        await this.load('commandLastUsed');
        this.checkCommandScope(scope);
        if (!this.commandLastUsed[scope]) return;
        let query = { $unset: {} };
        query.$unset[scope] = 0;
        await this.update(query);
        let deletedScope = this.commandLastUsed[scope];
        let tempData = this.cloneData();
        delete tempData.commandLastUsed[scope];
        this.data.next(tempData);
        return deletedScope;
    }

    /**
     * If this user can use the command based on usage limits
     *
     * @param {CommandScope} scope guild id / 'dm' / 'global'
     * @param {string} commandName name of the command
     * @param {CommandUsageLimits} limits usage limits
     * @returns boolean if the user can use the command
     * @memberof UserWrapper
     */
    async canUseCommand(scope: CommandScope, commandName: string, limits: CommandUsageLimits) {
        if (!limits.enabled) return false;
        if (limits.localCooldown && Date.now() < ((await this.getCommandLastUsed(scope, commandName)) + limits.localCooldown))
            return false;
        if (limits.globalCooldown && Date.now() < ((await this.getCommandLastUsed('global', commandName)) + limits.globalCooldown))
            return false;
        return true;
    }
}