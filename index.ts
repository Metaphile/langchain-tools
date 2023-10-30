import { ChatOpenAI } from "langchain/chat_models/openai"
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents"
import { DynamicTool } from "langchain/tools"
import { createInterface } from "readline"

// some notes:
// when one agent delegates to another, it gives the new agent a summary of relevant context.
// each agent has its own conversation history, so if the user has interacted with an agent before, the agent will remember that.
// different agents can use different models.

const main = async () => {
  const cli = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // don't echo input
    prompt: "🧑 ", // default is "> "
  })

  cli.prompt()

  let currentExecutor: AgentExecutor

  // this tool is for domain-specific agents to delegate upward to a general agent
  // because the general agent tries to delegate to domain-specific agents, there is the potential for infinite loops
  const escalateTool = new DynamicTool({
    name: "escalateTool",
    description: "Call this tool if the user needs something that is outside of your domain. Pass in a summary of the relevant context.",
    func: async (input: string): Promise<string> => {
      console.log(`LLM invoked tool ESCALATE with input "${input}"`)
      currentExecutor = generalExecutor
      return currentExecutor.run(input)
    }
  })

  const shoppingExecutor = await (async () => {
    const tools = [
      escalateTool,
      new DynamicTool({
        name: "amazonSearchTool",
        description: "Call this tool to search for products on Amazon (amazon.com) by keyword or description. It returns a JSON list of product descriptions and prices in USD. Output the results as a numbered list so the user can refer to them easily.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked tool AMAZON SEARCH with input "${input}"`)
          // interestingly, if these hard-coded results don't match the incoming query, ChatGPT tries different permutations and eventually gives up
          return JSON.stringify([
            { description: "T-shirt", price: 20 },
            { description: "Dress shirt", price: 50 },
            { description: "Long sleeve shirt", price: 35 },
          ])
        },
      }),
    ]
  
    const llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 })
  
    return initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "structured-chat-zero-shot-react-description",
      agentArgs: {
        prefix: "Your domain is online shopping. Do your best to help the user with shopping related requests. Only use the escalate tool if the user wants to do something that is not shopping related.",
      },
    })
  })()

  const bankingExecutor = await (async () => {
    const tools = [
      escalateTool,
      new DynamicTool({
        name: "creditCardBalanceTool",
        description: "Call this tool to retrieve the balance and credit limit for the user's primary credit card. This tool does not require any input.",
        func: async (): Promise<string> => {
          console.log(`LLM invoked tool CREDIT CARD BALANCE`)
          return "The user has a balance of 2,000 USD and a credit limit of 10,000 USD."
        },
      }),
    ]
  
    const llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 })
  
    return initializeAgentExecutorWithOptions(tools, llm, {
      agentType: "structured-chat-zero-shot-react-description",
      agentArgs: {
        prefix: "Your domain is online banking. Do your best to help the user with banking related requests. Only use the escalate tool if the user wants to do something that is not banking related.",
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
          console.log(`LLM invoked tool SWITCH TO SHOPPING EXECUTOR with input "${input}"`)
          currentExecutor = shoppingExecutor
          return currentExecutor.run(input)
        },
      }),
      new DynamicTool({
        name: "switchToBankingExecutorTool",
        description: "Call this tool if the user wants to do some online banking. Pass in a summary of the relevant context.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked tool SWITCH TO BANKING EXECUTOR with input "${input}"`)
          currentExecutor = bankingExecutor
          return currentExecutor.run(input)
        },
      }),
    ]
  
    const llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 })
  
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
