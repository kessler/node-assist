#!/usr/bin/env node

import { Command } from 'commander'
import fs from 'node:fs/promises'
import config from './lib/config.mjs'
import inquirer from 'inquirer'
import { createApi } from './lib/openai.mjs'
import { homedir } from 'node:os'
import path from 'node:path'
import chalk from 'chalk'

async function main() {
  const { version } = JSON.parse(await fs.readFile(path.join(new URL('.', import.meta.url).pathname, './package.json')))
  const program = new Command()

  program
    .name('kes')
    .description('kessler AI assistant (@kessler/assist)')
    .version(version)
    .action(genericQueryCommandInteractive)

  program
    .command('query [prompt]').alias('q')
    .description('send a query to chatgpt. this command is also accessible by running the cli tool (just run kes) for an interactive experience')
    .action(genericQueryCommandOnce)

  program
    .command('code [prompt]').alias('c')
    .description('send a code prompt')
    .action(codeQueryCommand)

  program
    .command('init')
    .description('run once to init the cli')
    .action(init)

  program
    .command('config [operation]')
    .description('view and edit the local configuration, using get, set and list')
    .action(configCommand)

  program.parse()
}

main()

async function genericQueryCommandInteractive(options, command) {
  checkInitialized()

  let context = []
  
  console.log('send an empty string (hit enter) to exit')

  let content = await prompt(chalk.green('[me]:'))
  if (content !== '') {
    context.push({ role: 'user', content })
  }

  const openai = createApi(config.openai)

  while (content !== '') {
    const response = await openai.chat(...context)
    const responseText = openai.toText(response)
    
    context.push({ role: 'assistant', content: responseText })
    printResponse(responseText)

    content = await prompt(chalk.green('[me]:'))
    if (content !== '') {
      context.push({ role: 'user', content })
    }
  }
}

async function genericQueryCommandOnce(content, options, command) {
  checkInitialized()
  
  if (!content) {
    console.log('no prompt provided')
    return
  }

  const openai = createApi(config.openai)
  const response = await openai.chat({ role: 'user', content })
  
  printResponse(openai.toText(response))
}

async function codeQueryCommand(str, options, command) {
  checkInitialized()

  let userCode = str

  if (!userCode) {
    userCode = await openPromptWithEditor('type a code related query')

    if (!userCode) {
      console.log('nothing to do, exiting...')
      return
    }
  }

  const openai = createApi(config.openai)

  const response = await openai.chat({
    role: 'system',
    content: 'when asked to write code, you will reply with code only in pure textual form'
  }, {
    role: 'user',
    content: `do not include any introduction in your response. write only code: ${userCode}. do not include any introduction in your response. write only code`
  })

  printResponse(openai.toText(response))
}

async function openPromptWithEditor(message) {
  let result = await prompt(`${message} (hit enter to open the editor):`)

  if (!result) {
    result = await prompt(`editor mode`, { type: 'editor' })
  }

  return result
}

async function init() {
  const fullConfigPath = path.join(homedir(), '.config', 'kessler_assist')
  let isNew = false
  try {
    await fs.access(fullConfigPath)
  } catch (e) {
    if (e.code === 'ENOENT') {
      isNew = true
    } else {
      throw e
    }
  }

  if (!isNew) {
    const response = await prompt('already initialized, do you want to override?', { defaultValue: 'no' })
    if (response !== 'yes') {
      if (response.toLowerCase() !== 'no') {
        console.warn(`invalid answer, use "yes" or "no", aborting for now.`)
      }
      return
    }
  }

  const key = await prompt('openAI api key:')
  if (!key) {
    console.log('cancelling...')
    return
  }

  await fs.writeFile(fullConfigPath, JSON.stringify({ openai: { key } }))
}

function configCommand() {
  console.log('not implemented yet')
}

function checkInitialized() {

  if (!config.openai.key) {
    console.log('run init command first')
    throw new Error('not initialized')
  }
}

async function prompt(message, { type = 'input', defaultValue } = {}) {
  const { answer } = await inquirer.prompt([{ message, type, prefix: '', name: 'answer', default: defaultValue }])
  return answer
}

function printResponse(response) {
  console.log(`${chalk.blue.bold('[chatgpt]')}:\n${response}`)
}
