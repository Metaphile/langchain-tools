import { ChatOpenAI } from "langchain/chat_models/openai"
import { Calculator } from "langchain/tools/calculator"
import { initializeAgentExecutorWithOptions } from "langchain/agents"
import { DynamicTool } from "langchain/tools"
import { createInterface } from "readline"

const main = async () => {
  const llm = new ChatOpenAI({})

  const tools = [
    new Calculator(),
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
  })

  console.clear()
  cli.prompt()

  for await (const input of cli) {
    const result = await executor.run(input)
    console.log(result)
    cli.prompt()
  }
}

main()
