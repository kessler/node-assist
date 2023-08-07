#!/usr/bin/env node

import debug from 'debug'
import { program } from 'commander'
import fs from 'node:fs/promises'
import path from 'node:path'
import config, { configFileExists, saveConfig } from './lib/config.mjs'
import inquirer from 'inquirer'
import { createApi } from './lib/openai.mjs'
import chalk from 'chalk'
import initEmbedding from './lib/embedding.mjs'

const d = debug('kessler:assist')

async function main() {
  const { version } = JSON.parse(await fs.readFile(path.join(new URL('.',
    import.meta.url).pathname, './package.json')))

  program
    .name('kes')
    .description('kessler AI assistant (@kessler/assist)')
    .version(version)
    .option('-a, --actor [actor]', 'send a role:system message with a predefined prompt')
    .option('-p, --preprompt <preprompt>', 'prepend some text to the beginning of the conversation, this is useful with kes query where content is coming from stdin. When combined with --actor, preprompt will immediately follow the role system message (actor prompt)')
    .option('-t, --temperature <temperature>', 'temprature effects the consistency of the response, representing a tradeoff between coherence and creativity')
    .option('-m, --model [model]', 'select an ai model to use, currently only openai models are supported. If you don\'t specify a value, a list of available models will be displayed for you to select from')
    .action(wrapCommand(genericQueryCommandInteractive))

  program
    .command('query [prompt]').alias('q')
    .description('send a query to chatgpt. this command is also accessible by running the cli tool (just run kes) for an interactive experience')
    .action(wrapCommand(genericQueryCommandOnce, { respond: printBareResponse }))

  program
    .command('actor <subcommand>').alias('a')
    .description('add, remove or list')
    .action(wrapCommand(actorCommand, { respond: printBareResponse, useGlobalOptions: false }))

  program
    .command('embedding <subcommand> <collectionName> [text]').alias('e')
    .description('add, remove or query embedding')
    .action(((subcommand, collectionName, text, options, command) => 
      embeddingCommand(subcommand, collectionName, text, options, command, { 
        respond: printBareResponse,
        prompt: showPrompt,
        openai: createApi({ ...config.openai })
      })))

  program
    .command('code [prompt]').alias('c')
    .description('send a code prompt')
    .action(wrapCommand(codeQueryCommand, { respond: printBareResponse }))

  program
    .command('init')
    .description('run once to init the cli')
    .action(wrapCommand(init, { checkInit: () => {} }))

  program
    .command('config [operation]')
    .description('view and edit the local configuration, using get, set and list')
    .action(wrapCommand(configCommand))

  await program.parseAsync()
}

main()

function wrapCommand(commandFunction, { respond = printResponse, checkInit = checkInitialized, useGlobalOptions = true } = {}) {
  return async (param, options, command) => {

    if (command === undefined) {
      command = options
      options = param
    }

    if (useGlobalOptions) {
      options = command.optsWithGlobals()
    }

    const model = await getModel(options)

    checkInit()
    const openai = createApi({ ...config.openai, temperature: options.temperature, model })
    const context = []

    const actor = await getActor(options)
    if (actor) {
      context.push({ role: 'system', content: actor.prompt })
    }

    const preprompt = options.preprompt
    if (preprompt) {
      context.push({ role: 'user', content: preprompt })
    }

    d('options: %o', options)
    d('param: %o', param)

    return commandFunction(param, options, command, { openai, respond, prompt: showPrompt, context })
  }
}

async function genericQueryCommandInteractive(param, options, command, { openai, respond, prompt, context }) {

  console.log('send an empty string (hit enter) to exit')

  let content = await prompt(chalk.green('[me]:'))
  if (content !== '') {
    context.push({ role: 'user', content })
  }

  while (content !== '') {
    const response = await openai.chat(...context)
    const responseText = openai.toText(response)

    context.push({ role: 'assistant', content: responseText })
    respond(responseText)

    content = await prompt(chalk.green('[me]:'))
    if (content !== '') {
      context.push({ role: 'user', content })
    }
  }
}

async function genericQueryCommandOnce(content, options, command, { openai, respond, prompt, context }) {
  if (!content) {
    console.error('no content provided, waiting for content from stdin...')

    content = await readToEnd(process.stdin)
  }

  context.push({ role: 'user', content })

  const response = await openai.chat(...context)
  d(context)
  respond(openai.toText(response))
}

async function codeQueryCommand(str, options, command, { openai, respond, prompt, context }) {

  let userCode = str

  if (!userCode) {
    userCode = await openPromptWithEditor('type a code related query')

    if (!userCode) {
      console.log('nothing to do, exiting...')
      return
    }
  }

  const response = await openai.chat(...[...context, {
    role: 'system',
    content: 'when asked to write code, you will reply with code only in pure textual form'
  }, {
    role: 'user',
    content: `do not include any introduction in your response. write only code: ${userCode}. do not include any introduction in your response. write only code`
  }])

  respond(openai.toText(response))
}

async function actorCommand(subcommand, options, command, { prompt }) {
  if (subcommand === 'list') {
    console.log(Object.keys(config.actors).join('\n-'))
    return
  }

  if (subcommand === 'add') {
    const name = await prompt(chalk.green('actor name:'))
    const actorPrompt = await prompt(chalk.green('actor prompt:'))
    config.actors[name] = { prompt: actorPrompt, name }

    await saveConfig()
    return
  }

  if (subcommand === 'remove') {
    const choices = ['- cancel', ...Object.keys(config.actors)]
    const name = await prompt(chalk.green('Select actor to remove:'), { type: 'list', choices })
    if (name === '- cancel') return

    const areYouSure = await prompt(chalk.red(`are you sure you want to remove "${name}"?`), { defaultValue: 'no' })

    if (areYouSure === 'yes') {
      delete config.actors[name]
      await saveConfig()
    }
    return
  }

  throw new Error('no such sub command for command actor')
}

async function embeddingCommand(subcommand, collectionName, text, options, command, { respond, prompt, openai }) {
  const { add, query, delete } = await initEmbedding(openai)

  if (text === undefined) {
    text = await prompt(chalk.green('text:'))
  }

  if (!text) {
    return
  }

  if (subcommand === 'add') {
    await add(collectionName, text, { created: Date.now() })
    return
  }

  if (subcommand === 'query') {
    respond(await query(collectionName, text))
    return
  }

  if (subcommand === 'delete') {
    await delete(collectionName, JSON.parse(text))
  }

  throw new Error('no such sub command for command actor')
}

async function getActor(options) {
  if (!options.hasOwnProperty('actor')) {
    return
  }

  let actor = options.actor

  if (actor === true) {
    actor = await showPrompt(chalk.green('actor name:'))
  }

  if (!actor) {
    console.log(chalk.red(`cannot use empty actor name`))
    process.exit()
  }

  const actorConfig = config.actors[actor]
  if (!actorConfig) {
    console.log(chalk.red(`no such actor "${actor}"" configured`))
    process.exit()
  }

  console.log(chalk.gray(`acting as ${actor}`))

  return actorConfig
}

const MODELS = ['gpt-4', 'gpt-4-0613', 'gpt-4-32k', 'gpt-4-32k-0613', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo-0613', 'gpt-3.5-turbo-16k-0613']

async function getModel(options) {
  if (!options.hasOwnProperty('model')) {
    return
  }

  let model = options.model
  if (model === true) {
    model = await showPrompt('select model:', {
      type: 'list',
      choices: MODELS
    })
  }

  if (!MODELS.includes(model)) {
    throw new Error('invalid or unknown model')
  }

  return model
}

async function init(param, options, command, { respond, prompt }) {
  if (await configFileExists() && config.openai.key) {
    const response = await prompt('already initialized, do you want to override?', { defaultValue: 'no' })
    if (response !== 'yes') {
      if (response.toLowerCase() !== 'no') {
        respond(`invalid answer, use "yes" or "no", aborting for now.`)
      }
      return
    }
  }

  const key = await prompt('openAI api key:')
  if (!key) {
    respond('cancelling...')
    return
  }

  config.openai.key = key
  const filename = await saveConfig()
  console.log(`saved config to "${filename}"`)
}

function configCommand() {
  console.log('not implemented yet')
}

function checkInitialized() {

  if (!config.openai.key) {
    console.log('Not initialized, run \'kes init\' command first')
    process.exit()
  }
}

async function showPrompt(message, { type = 'input', defaultValue, choices = [] } = {}) {
  const { answer } = await inquirer.prompt([{ message, type, prefix: '', name: 'answer', default: defaultValue, choices }])
  return answer
}

async function openPromptWithEditor(message) {
  let result = await showPrompt(`${message} (hit enter to open the editor):`)

  if (!result) {
    result = await showPrompt(`editor mode`, { type: 'editor' })
  }

  return result
}

function printResponse(response) {
  if (typeof response === 'object') {
    response = JSON.stringify(response)
  }
  console.log(`${chalk.blue.bold('[chatgpt]')}:\n${response}`)
}

function printBareResponse(response) {
  console.log(response)
}

async function readToEnd(stream) {
  let data = ''
  for await (const chunk of stream) {
    data += chunk.toString('utf8')
  }

  return data
}