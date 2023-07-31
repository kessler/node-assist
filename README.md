# @kessler/assist

personal AI assistant

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

or open your default text editor for longer texts:
```
  $ kes query
  editor mode Press <enter> to launch your preferred editor.
  ...chatgpt response after closing the editor...
```

## Actor commands
Manage actors. Actors will be sent as ```{ "role": "system" }``` before queries or in interactive mode.
Use them by specifying the `--actor=[actor]` in `kes` or `kes query`

### add 
### remove
### list



### tasks
- code query need to type enter twice to get to editor... 
- implement config commands
- implement history

### resources
- https://github.com/SBoudrias/Inquirer.js
- https://the-decoder.com/chatgpt-guide-prompt-strategies/
- https://prompts.chat/
- https://blog.tryamigo.com/how-to-use-chatgpt-for-coding/
