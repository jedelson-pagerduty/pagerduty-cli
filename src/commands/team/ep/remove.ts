import { AuthenticatedBaseCommand } from '../../../base/authenticated-base-command'
import { CliUx, Flags } from '@oclif/core'
import chalk from 'chalk'
import * as utils from '../../../utils'
import { PD } from '../../../pd'

export default class TeamEpRemove extends AuthenticatedBaseCommand<typeof TeamEpRemove> {
  static description = 'Remove PagerDuty escalation policies from Teams.'

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'Select teams whose names contain the given text',
    }),
    ids: Flags.string({
      char: 'i',
      description: 'The IDs of teams to remove escalation policies from.',
      exclusive: ['name', 'pipe'],
      multiple: true,
    }),
    ep_ids: Flags.string({
      char: 'e',
      description: 'Remove an escalation policy with this ID. Specify multiple times for multiple escalation policies.',
      multiple: true,
    }),
    ep_names: Flags.string({
      char: 'E',
      description: 'Remove an escalation policy with this name. Specify multiple times for multiple escalation policies.',
      multiple: true,
    }),
  }

  async run() {
    let team_ids = []
    if (this.flags.name) {
      CliUx.ux.action.start('Finding teams in PD')
      const teams = await this.pd.fetch('teams', { params: { query: this.flags.name } })
      if (teams.length === 0) {
        CliUx.ux.action.stop(chalk.bold.red('no teams found matching ') + chalk.bold.blue(this.flags.name))
        this.exit(0)
      }
      for (const team of teams) {
        team_ids.push(team.id)
      }
    } else if (this.flags.ids) {
      const invalid_ids = utils.invalidPagerDutyIDs(this.flags.ids)
      if (invalid_ids.length > 0) {
        this.error(`Invalid team IDs ${chalk.bold.blue(invalid_ids.join(', '))}`, { exit: 1 })
      }
      team_ids = this.flags.ids
    } else {
      this.error('You must specify one of: -i, -n', { exit: 1 })
    }

    if (team_ids.length === 0) {
      CliUx.ux.action.stop(chalk.bold.red('no teams specified'))
      this.exit(0)
    }

    let ep_ids: string[] = []
    if (this.flags.ep_ids) {
      ep_ids = [...ep_ids, ...this.flags.ep_ids]
    }
    if (this.flags.ep_names) {
      for (const name of this.flags.ep_names) {
        // eslint-disable-next-line no-await-in-loop
        const ep_id = await this.pd.epIDForName(name)
        if (ep_id === null) {
          this.error(`No escalation policy was found with the name ${chalk.bold.blue(name)}`, { exit: 1 })
        } else {
          ep_ids.push(ep_id)
        }
      }
    }
    ep_ids = [...new Set(ep_ids)]

    const invalid_ids = utils.invalidPagerDutyIDs(ep_ids)
    if (invalid_ids && invalid_ids.length > 0) {
      this.error(`Invalid escalation policy ID's: ${invalid_ids.join(', ')}`, { exit: 1 })
    }

    if (ep_ids.length === 0) {
      this.error('No escalation policies specified. Please specify some EPs using -e, -E')
    }

    const requests: PD.Request[] = []

    for (const team_id of team_ids) {
      for (const ep_id of ep_ids) {
        requests.push({
          endpoint: `teams/${team_id}/escalation_policies/${ep_id}`,
          method: 'DELETE',
        })
      }
    }

    const r = await this.pd.batchedRequestWithSpinner(requests, {
      activityDescription: `Removing ${ep_ids.length} escalation policies from ${team_ids.length} teams`,
    })
    for (const failure of r.getFailedIndices()) {
      const f = requests[failure] as any
      const [, team_id, , ep_id] = f.endpoint.split('/')
      // eslint-disable-next-line no-console
      console.error(`${chalk.bold.red('Failed to remove EP ')}${chalk.bold.blue(ep_id)}${chalk.bold.red(' from team ')}${chalk.bold.blue(team_id)}: ${r.results[failure].getFormattedError()}`)
    }
  }
}
