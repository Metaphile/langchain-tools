import { ChatOpenAI } from "langchain/chat_models/openai"
import { Calculator } from "langchain/tools/calculator"
import { initializeAgentExecutorWithOptions } from "langchain/agents"
import { DynamicTool } from "langchain/tools"
import { createInterface } from "readline"

const main = async () => {
  const llm = new ChatOpenAI({})

  const tools = [
    // new Calculator(), // seems like GPT can do all kinds of math, although it sometimes makes ridiculous mistakes
    new DynamicTool({
      name: "currentTimeTool",
      description: "Get the current date and time in ISO format",
      func: async (input: string): Promise<string> => {
        return new Date().toISOString()
      },
    }),
    // new DynamicTool({
    //   name: "logMessageTool",
    //   description: "Log a message to the console",
    //   func: async (input: string): Promise<string> => {
    //     console.log(input)
    //     return "success"
    //   },
    // }),
  ]

  const executor = await initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "chat-conversational-react-description",
  })

  const cli = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // don't echo input
    // prompt: ">", // default is ">"
  })

  // console.clear()
  cli.prompt()

  for await (const input of cli) {
    const result = await executor.run(input)
    console.log(result)
    cli.prompt()
  }
}

main()
