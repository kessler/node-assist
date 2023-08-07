import { Configuration, OpenAIApi } from 'openai'

export function createApi({ model = 'gpt-4', key = undefined, temperature = undefined } = {}) {
  
  if (temperature !== undefined) {
    temperature = parseFloat(temperature)
    if (isNaN(temperature)) {
      throw new Error('temperature must be a number')
    }
  }
  const configuration = new Configuration({ apiKey: key })

  const openai = new OpenAIApi(configuration)

  return {
    chat: (...messages) => openai.createChatCompletion({ model, messages, temperature }),
    toText: response => response.data.choices.map(choice => choice.message.content).join('\n')
  }
}