import { BaseCommand } from '../../base/base-command'
import { CliUx, Flags } from '@oclif/core'
import chalk from 'chalk'

export default class AuthDelete extends BaseCommand<typeof AuthDelete> {
  static description = 'Delete a PagerDuty domain authentication'

  static flags = {
    alias: Flags.string({
      char: 'a',
      description: 'The alias of the PD domain authentication to delete',
      required: true,
    }),
  }

  async run() {
    if (!this._config.has(this.flags.alias)) {
      this.error(`Alias ${chalk.bold.blue(this.flags.alias)} doesn't exist`, {
        exit: 1,
      })
    }
    const deletingDefault =
      this._config.defaultAlias() === this.flags.alias ? true : false
    CliUx.ux.action.start(`Deleting auth for ${this.flags.alias}`)
    if (this._config.delete(this.flags.alias)) {
      this._config.save()
      this.init()
      CliUx.ux.action.stop(chalk.bold.green('done'))
      if (this._config.all().length === 0) {
        this.log(
          'That was your only configured domain, so you\'re not logged in to PagerDuty any more'
        )
      } else if (deletingDefault) {
        this.log(
          'That was your default domain, so you\'re not logged in to it any more'
        )
        const me = await this.me()
        const domain = await this.pd.domain()
        if (me && me.user.id) {
          CliUx.ux.action.stop(chalk.bold.green('done'))
          this.log(
            `You are logged in to ${chalk.bold.blue(
              domain
            )} as ${chalk.bold.blue(me.user.email)} (alias: ${chalk.bold.blue(
              this._config.defaultAlias()
            )})`
          )
        } else {
          CliUx.ux.action.stop(chalk.bold.green('done'))
          this.log(
            `You are logged in to ${chalk.bold.blue(
              domain
            )} using a legacy API token (alias: ${chalk.bold.blue(
              this._config.defaultAlias()
            )})`
          )
        }
      }
    } else {
      CliUx.ux.action.stop(chalk.bold.red('failed!'))
      this.error(`Failed to delete ${this.flags.alias}. Are you sure it exists?`, {
        suggestions: ['pd auth:list'],
        exit: 1,
      })
    }
  }
}
