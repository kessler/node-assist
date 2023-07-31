#!/usr/bin/env node

import { Command } from 'commander'
import fs from 'node:fs/promises'
import path from 'node:path'
import config, { configFileExists, saveConfig } from './lib/config.mjs'
import inquirer from 'inquirer'
import { createApi } from './lib/openai.mjs'
import chalk from 'chalk'

async function main() {
  const { version } = JSON.parse(await fs.readFile(path.join(new URL('.', import.meta.url).pathname, './package.json')))
  const program = new Command()

  program
    .name('kes')
    .description('kessler AI assistant (@kessler/assist)')
    .version(version)
    .action(wrapCommand(genericQueryCommandInteractive))

  program
    .command('query [prompt]').alias('q')
    .description('send a query to chatgpt. this command is also accessible by running the cli tool (just run kes) for an interactive experience')
    .action(wrapCommand(genericQueryCommandOnce, { respond: printBareResponse }))

  program
    .command('actor [subcommand]')
    .description('add, remove or list')
    .action(wrapCommand(genericQueryCommandOnce, { respond: printBareResponse }))

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

  program.parse()
}

main()

function wrapCommand(commandFunction, { respond = printResponse, checkInit = checkInitialized } = {}) {
  return (param, options, command) => {
    if (command === undefined) {
      command = options
      options = param
    }

    checkInit()
    const openai = createApi(config.openai)
    return commandFunction(param, options, command, { openai, respond, prompt: showPrompt })
  }
}

async function genericQueryCommandInteractive(param, options, command, { openai, respond, prompt }) {
  
  let context = []
  
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

async function genericQueryCommandOnce(content, options, command, { openai, respond, prompt }) {
  
  if (!content) {
    content = await prompt('editor mode', { type: 'editor' })
  }

  if (!content) {
    console.error('no content provided, aborting')
    return
  }

  const response = await openai.chat({ role: 'user', content })
  
  respond(openai.toText(response))
}

async function codeQueryCommand(str, options, command, { openai, respond, prompt }) {

  let userCode = str

  if (!userCode) {
    userCode = await openPromptWithEditor('type a code related query')

    if (!userCode) {
      console.log('nothing to do, exiting...')
      return
    }
  }

  const response = await openai.chat({
    role: 'system',
    content: 'when asked to write code, you will reply with code only in pure textual form'
  }, {
    role: 'user',
    content: `do not include any introduction in your response. write only code: ${userCode}. do not include any introduction in your response. write only code`
  })

  respond(openai.toText(response))
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
  await saveConfig()
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

async function showPrompt(message, { type = 'input', defaultValue } = {}) {
  const { answer } = await inquirer.prompt([{ message, type, prefix: '', name: 'answer', default: defaultValue }])
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
  console.log(`${chalk.blue.bold('[chatgpt]')}:\n${response}`)
}

function printBareResponse(response) {
  console.log(response)
}
