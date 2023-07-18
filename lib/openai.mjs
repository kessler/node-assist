import { Configuration, OpenAIApi } from 'openai'

export function createApi({ model = 'gpt-4', key = undefined } = {}) {
  
  const configuration = new Configuration({ apiKey: key })

  const openai = new OpenAIApi(configuration)

  return {
    chat: (...messages) => openai.createChatCompletion({ model, messages }),
    toText: response => response.data.choices.map(choice => choice.message.content).join('\n')
  }
}