#!/usr/bin/env node

import { Command } from 'commander'
import fs from 'node:fs/promises'
import config from './lib/config.mjs'
import inquirer from 'inquirer'
import { createApi } from './lib/openai.mjs'
import { homedir } from 'node:os'
import path from 'node:path'

async function main() {
  const { version } = JSON.parse(await fs.readFile('./package.json'))
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
  
  let content = await prompt('[chatgpt]:')
  if (content !== '') {
    context.push({ role: 'user', content })
  }

  const openai = createApi(config.openai)

  while (content !== '') {
    const response = await openai.chat(...context)

    console.log(openai.toText(response))

    content = await prompt('[chatgpt]:')
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
  console.log(openai.toText(response))
}

async function codeQueryCommand(str, options, command) {
  checkInitialized()

  let userCode = str

  if (!userCode) {
    userCode = await openPromptWithEditor('type a code related query')

    if (userCode === '') {
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

  console.log(openai.toText(response))
}

async function openPromptWithEditor(message) {
  let result = await prompt(`${message} (hit enter to open the editor):`)

  if (result === '') {
    result = await prompt(`${message}:`, 'editor')
  }

  return result
}

async function init() {
  const fullConfigPath = path.join(homedir(), '.config', 'kessler_assist')
  try {
    await fs.access(fullConfigPath)
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }

  const key = await prompt('openAI api key:')
  if (key === '') {
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

async function prompt(message, type = 'input') {
  const { answer } = await inquirer.prompt([{ message, type, prefix: '', name: 'answer' }])
  return answer
}