import keypress from 'keypress'

export function installMetaCommands(metaCommands) {

  keypress(process.stdin)

  process.stdin.on('keypress', function(ch, key) {
    if (key && key.name === 'c' && key.ctrl) {
      process.exit()
    }

    console.log(ch, key)
    const metaCommandEntries = Object.entries(metaCommands)
    for (const [keys, command] of metaCommandEntries) {
      let [key, ...modifiers] = keys.split('+')
      //command()
      //break
    }
  })

  process.stdin.setRawMode(true)
  process.stdin.resume()
}