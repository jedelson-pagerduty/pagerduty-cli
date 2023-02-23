import Command from '../../base'
import {CliUx, Flags} from '@oclif/core'
import chalk from 'chalk'

export default class FieldCreate extends Command {
  static description = 'Create a PagerDuty Custom Field'

  static flags = {
    ...Command.flags,
    namespace: Flags.string({
      char: 's',
      description: 'The logical grouping of fields to which this field belongs',
      default: 'incidents',
    }),
    name: Flags.string({
      char: 'n',
      description: 'An identifier for the field intended primarily for scripting or other programmatic use.',
      required: true,
    }),
    display_name: Flags.string({
      char: 'N',
      description: 'A human readable name for the field',
      required: true,
    }),
    description: Flags.string({
      char: 'd',
      description: 'A human readable description for the field',
    }),
    type: Flags.string({
      char: 't',
      description: 'The data type of the field',
      options: ['string', 'integer', 'float', 'boolean', 'datetime', 'url'],
    }),
    multi: Flags.boolean({
      char: 'm',
      description: 'Multi-value field. Specify to create a field that can contain a list of <type> values.',
    }),
    fixed: Flags.boolean({
      char: 'f',
      description: 'Fixed-options field. Specify to create a field that can only take on specific values defined in a list.',
    }),
    pipe: Flags.boolean({
      char: 'p',
      description: 'Print the field ID only to stdout, for use with pipes.',
    }),
  }

  async run() {
    const {flags} = await this.parse(this.ctor)

    const headers = {
      'X-EARLY-ACCESS': 'flex-service-early-access',
    }

    const {
      namespace,
      name,
      display_name,
      description,
      type:datatype,
      multi:multi_value,
      fixed:fixed_options
    } = flags

    const field = {
      field: {
        namespace,
        name,
        display_name,
        description: description as string,
        datatype,
        multi_value: multi_value ? true : false,
        fixed_options: fixed_options ? true : false,
      }
    }

    CliUx.ux.action.start('Creating PagerDuty field')
    const r = await this.pd.request({
      endpoint: 'fields',
      method: 'POST',
      data: field,
      headers,
    })
    if (r.isFailure) {
      this.error(`Failed to create field: ${r.getFormattedError()}`, {exit: 1})
    }
    CliUx.ux.action.stop(chalk.bold.green('done'))
    const returned_field = r.getData()

    if (flags.pipe) {
      this.log(returned_field.field.id)
    } else {
      this.log(`Created field ${chalk.bold.blue(returned_field.field.name)} (${chalk.bold.blue(returned_field.field.id)})`)
    }
  }
}
