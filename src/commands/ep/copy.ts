import { AuthenticatedBaseCommand } from '../../base/authenticated-base-command'
import { CliUx, Flags } from '@oclif/core'
import chalk from 'chalk'
import * as utils from '../../utils'

export default class EpCopy extends AuthenticatedBaseCommand<typeof EpCopy> {
  static description = 'Make a copy of a PagerDuty Escalation Policy'

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'The name of the escalation policy to copy.',
      exclusive: ['id'],
    }),
    id: Flags.string({
      char: 'i',
      description: 'The ID of the escalation policy to copy.',
      exclusive: ['name'],
    }),
    destination: Flags.string({
      char: 'd',
      description: 'The name for the new escalation policy',
    }),
    open: Flags.boolean({
      char: 'o',
      description: 'Open the new escalation policy in the browser',
    }),
    pipe: Flags.boolean({
      char: 'p',
      description: 'Print the new escalation policy ID only to stdout, for use with pipes.',
    }),
  }

  async run() {
    if (!([this.flags.name, this.flags.id].some(Boolean))) {
      this.error('You must specify one of: -i, -n', { exit: 1 })
    }

    let ep_id

    if (this.flags.name) {
      ep_id = await this.pd.epIDForName(this.flags.name)
      if (!ep_id) {
        this.error(`No escalation policy was found with the name ${chalk.bold.blue(this.flags.name)}`, { exit: 1 })
      }
    }
    if (this.flags.id) {
      ep_id = this.flags.id
      if (utils.invalidPagerDutyIDs([ep_id]).length > 0) {
        this.error(`Invalid escalation policy ID ${chalk.bold.blue(ep_id)}`, { exit: 1 })
      }
    }

    if (!ep_id) {
      this.error('No escalation policy specified', { exit: 1 })
    }

    CliUx.ux.action.start(`Getting escalation policy ${chalk.bold.blue(ep_id)}`)
    let r = await this.pd.request({
      endpoint: `escalation_policies/${ep_id}`,
      method: 'GET',
    })
    if (r.isFailure) {
      CliUx.ux.action.stop(chalk.bold.red('failed!'))
      this.error(`Couldn't get escalation policy ${chalk.bold.blue(ep_id)}: ${r.getFormattedError()}`)
    }

    const source_ep = r.getData()
    const { description, on_call_handoff_notifications, num_loops, escalation_rules } = source_ep.escalation_policy
    const dest_ep = {
      escalation_policy: {
        type: 'escalation_policy',
        name: this.flags.destination || `${this.flags.name} copy ${new Date()}`,
        description: description,
        on_call_handoff_notifications: on_call_handoff_notifications,
        num_loops: num_loops,
        escalation_rules: escalation_rules,
      },
    }
    CliUx.ux.action.start(`Copying escalation policy ${chalk.bold.blue(ep_id)}`)
    r = await this.pd.request({
      endpoint: 'escalation_policies',
      method: 'POST',
      data: dest_ep,
    })
    if (r.isFailure) {
      CliUx.ux.action.stop(chalk.bold.red('failed!'))
      this.error(`Couldn't create escalation policy: ${r.getFormattedError()}`)
    }
    const returned_ep = r.getData()
    CliUx.ux.action.stop(chalk.bold.green('done'))

    if (this.flags.pipe) {
      this.log(returned_ep.escalation_policy.id)
    } else if (this.flags.open) {
      CliUx.ux.action.start(`Opening ${chalk.bold.blue(returned_ep.escalation_policy.html_url)} in the browser`)
      try {
        await CliUx.ux.open(returned_ep.escalation_policy.html_url)
      } catch (error) {
        CliUx.ux.action.stop(chalk.bold.red('failed!'))
        this.error('Couldn\'t open your browser. Are you running as root?', { exit: 1 })
      }
      CliUx.ux.action.stop(chalk.bold.green('done'))
    } else {
      this.log(`Your new escalation policy is at ${chalk.bold.blue(returned_ep.escalation_policy.html_url)}`)
    }
  }
}
