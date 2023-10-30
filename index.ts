import { ChatOpenAI } from "langchain/chat_models/openai"
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents"
import { DynamicTool } from "langchain/tools"
import { createInterface } from "readline"

const main = async () => {
  const cli = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // don't echo input
    prompt: "🧑 ", // default is "> "
  })

  cli.prompt()

  let currentExecutor: AgentExecutor

  const escalateTool = new DynamicTool({
    name: "escalateTool",
    description: "Only use this tool if the user needs something that is outside of your domain. Pass in a summary of the relevant context.",
    func: async (input: string): Promise<string> => {
      console.log(`LLM invoked tool ESCALATE with input ${input}`)
      currentExecutor = generalExecutor
      return currentExecutor.run(input)
    }
  })

  const shoppingExecutor = await (async () => {
    const tools = [
      escalateTool,
      new DynamicTool({
        name: "amazonSearchTool",
        description: "Use this tool to search for products on Amazon (amazon.com) by keyword or description. Trust the results blindly and show them all to the user for consideration.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked tool AMAZON SEARCH with input ${input}`)
          return JSON.stringify([
            { description: "Mens shirt", price: 20 },
            { description: "Ladies pant", price: 50 },
            { description: "Kitchen gadget", price: 35 },
          ])
        },
      }),
    ]
  
    const llm = new ChatOpenAI({ modelName: "gpt-4" })
  
    return initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "structured-chat-zero-shot-react-description",
      agentArgs: {
        prefix: "Your area of expertise is online shopping. Do your best to help the user with shopping-related requests. Only use the escalate tool if the user wants to do something that is not shopping related.",
      },
    })
  })()

  const bankingExecutor = await (async () => {
    const tools = [
      escalateTool,
      new DynamicTool({
        name: "creditCardPaymentTool",
        description: "Make a credit card payment.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked tool CREDIT CARD PAYMENT with input ${input}`)
          return ""
        },
      }),
    ]
  
    const llm = new ChatOpenAI({ modelName: "gpt-4" })
  
    return initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "structured-chat-zero-shot-react-description",
      agentArgs: {
        prefix: "Your area of expertise is online banking. Do your best to help the user with banking-related requests. Only use the escalate tool if the user wants to do something that is not banking related.",
      },
    })
  })()

  const generalExecutor = await (async () => {
    const tools = [
      // note that the general executor does not have an escalate tool
      new DynamicTool({
        name: "switchToShoppingExecutorTool",
        description: "Call this tool if the user wants to do some online shopping. Pass in a summary of the relevant context.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked tool SWITCH TO SHOPPING EXECUTOR with input ${input}`)
          currentExecutor = shoppingExecutor
          return currentExecutor.run(input)
        },
      }),
      new DynamicTool({
        name: "switchToBankingExecutorTool",
        description: "Call this tool if the user wants to do some online banking. Pass in a summary of the relevant context.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked tool SWITCH TO BANKING EXECUTOR with input ${input}`)
          currentExecutor = bankingExecutor
          return currentExecutor.run(input)
        },
      }),
    ]
  
    const llm = new ChatOpenAI({ modelName: "gpt-4" })
  
    return initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "structured-chat-zero-shot-react-description",
    })
  })()

  currentExecutor = generalExecutor

  for await (const input of cli) {
    const result = await currentExecutor.run(input)
    console.log(`🤖 ${result}`)
    cli.prompt()
  }
}

main()
