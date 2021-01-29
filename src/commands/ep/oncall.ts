import Command from '../../base'
import {flags} from '@oclif/command'
import cli from 'cli-ux'
import chalk from 'chalk'
import * as pd from '../../pd'
import * as utils from '../../utils'
import * as chrono from 'chrono-node'
import jp from 'jsonpath'

export default class EpOncall extends Command {
  static description = 'List a PagerDuty Escalation Policy\'s on call shifts.'

  static flags = {
    ...Command.flags,
    id: flags.string({
      char: 'i',
      description: 'Show oncalls for the EP with this ID.',
      exclusive: ['email', 'me'],
    }),
    name: flags.string({
      char: 'n',
      description: 'Show oncalls for the EP with this name.',
      exclusive: ['id'],
    }),
    since: flags.string({
      description: 'The start of the date range over which you want to search.',
    }),
    until: flags.string({
      description: 'The end of the date range over which you want to search.',
    }),
    keys: flags.string({
      char: 'k',
      description: 'Additional fields to display. Specify multiple times for multiple fields.',
      multiple: true,
    }),
    json: flags.boolean({
      char: 'j',
      description: 'output full details as JSON',
      exclusive: ['columns', 'filter', 'sort', 'csv', 'extended'],
    }),
    ...cli.table.flags(),
  }

  async run() {
    const {flags} = this.parse(EpOncall)

    // get a validated token from base class
    const token = this.token as string

    const params: Record<string, any> = {}

    let EPID
    if (flags.id) {
      if (utils.invalidPagerDutyIDs([flags.id]).length > 0) {
        this.error(`${chalk.bold.blue(flags.id)} is not a valid PagerDuty escalation policy ID`)
      }
      EPID = flags.id
    } else if (flags.name) {
      cli.action.start(`Finding PD escalation policy ${chalk.bold.blue(flags.name)}`)
      EPID = await pd.epIDForName(token, flags.name)
      if (!EPID) {
        cli.action.stop(chalk.bold.red('failed!'))
        this.error(`No EP was found with the name "${flags.name}"`, {exit: 1})
      }
    } else {
      this.error('You must specify one of: -i, -n', {exit: 1})
    }

    params['escalation_policy_ids[]'] = EPID

    if (flags.since) {
      const since = chrono.parseDate(flags.since)
      if (since) {
        params.since = since.toISOString()
      }
    }
    if (flags.until) {
      const until = chrono.parseDate(flags.until)
      if (until) {
        params.until = until.toISOString()
      }
    }

    cli.action.start(`Getting oncalls for EP ${chalk.bold.blue(EPID)}`)
    const r = await pd.fetch(token, 'oncalls', params)
    this.dieIfFailed(r)
    const oncalls = r.getValue()

    if (oncalls.length === 0) {
      cli.action.stop(chalk.bold.red('none found'))
      this.exit(0)
    }
    cli.action.stop(chalk.bold.green('done'))

    if (flags.json) {
      this.log(JSON.stringify(oncalls, null, 2))
      this.exit(0)
    }

    const columns: Record<string, object> = {
      start: {
        get: (row: any) => row.start ? (new Date(row.start)).toLocaleString() : '',
      },
      end: {
        get: (row: any) => row.end ? (new Date(row.end)).toLocaleString() : '',
      },
      level: {
        get: (row: any) => row.escalation_level,
      },
      user_name: {
        header: 'User Name',
        get: (row: any) => row.user?.summary || '',
      },
      schedule_name: {
        header: 'Schedule Name',
        get: (row: any) => row.schedule?.summary || '',
      },
    }

    if (flags.keys) {
      for (const key of flags.keys) {
        columns[key] = {
          header: key,
          get: (row: any) => utils.formatField(jp.query(row, key), '\n'),
        }
      }
    }

    const options = {
      printLine: this.log,
      ...flags, // parsed flags
    }
    cli.table(oncalls, columns, options)
  }
}
