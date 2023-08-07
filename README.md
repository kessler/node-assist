# @kessler/assist

Personal AI assistant / cli tool for accessing GPT.

## install

You'll need an openai api key.

```
  $ npm install -g @kessler/assist

  $ kes init
```

## Interactive mode

The simplest usage, like a session in chatgpt.

```
  $ kes
  send an empty string (hit enter) to exit
  [me]: hello
  [chatgpt]:
  Hello!
```

## Query command

Sends a query and get back the bare response from openai. Process will exit afterwards.

Specify query immediately in the cli:
```
  $ kes query hello
  Hello!
```

or read from stdin:
```
  $ echo 'hello' | kes query
  no content provided, waiting for content from stdin... (this is printed on stderr)
  Hi
```

## options
These options apply to interactive and query commands

### -a, --actor
Set an actor for this session, See actor command

### -p --preprompt
Prepend some text to the session, especially useful when ingesting content from stdin.

### -t, --temperature
Set the temperature for this session.

### -m, --model
Select a model for this session.

## Embedding commands
add, query and delete embedding.

### add

```
  $ kes embedding add mycollection "The little brown fox"
```

### query

```
  $ kes e query mycollection "the little dark fox"
  [{"similarity":0.9487346256454315,"text":"the little brown fox","metadata":{"created":1691421248707}}]
```

### del
TBD

## Actor commands
Manage actors. Actors will be sent as ```{ "role": "system" }``` before queries or in interactive mode.

An interesting discussion on "role system" [here](https://community.openai.com/t/the-system-role-how-it-influences-the-chat-behavior/87353/2)

Use actors by specifying the `--actor=[actor]` in `kes` or `kes query`

### add 

```
  $ kes actor add
  actor name: darkgpt
  actor prompt: ... prompt text here ...
```
### remove
```
  $ kes actor remove
  Select actor to remove: (Use arrow keys)
❯ - cancel
  prompt
  dark
```

### list
list all actors, visibility is a little broken right now :-)

## other stuff

### tasks
- implement config commands
- implement history

### resources
- https://github.com/SBoudrias/Inquirer.js
- https://the-decoder.com/chatgpt-guide-prompt-strategies/
- https://prompts.chat/
- https://blog.tryamigo.com/how-to-use-chatgpt-for-coding/
