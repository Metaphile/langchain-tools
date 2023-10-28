import { ChatOpenAI } from "langchain/chat_models/openai"
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents"
import { DynamicTool, DynamicStructuredTool } from "langchain/tools"
import { createInterface } from "readline"
import { StructuredOutputParser } from "langchain/output_parsers"
import { z } from "zod"

type Reminder = {
  id: string,
  description: string
  date: Date | null
}

class Reminders {
  private reminders: Reminder[] = []

  addReminder(description: Reminder["description"], date?: Reminder["date"]): void {
    const id = performance.now().toString()
    this.reminders.push({ id, description, date: date || null })
  }

  updateReminder(id: string, fields: Omit<Partial<Reminder>, "id">): void {
    const reminder = this.reminders.find(rm => rm.id === id)
    if (!reminder) {
      throw new Error(`There is no reminder with the ID ${id}`)
    }
    Object.assign(reminder, fields)
  }

  getReminders(): Reminder[] {
    return this.reminders
  }

  removeReminder(id: string): boolean {
    const reminderIdx = this.reminders.findIndex(rm => rm.id === id)
    if (reminderIdx >= 0) {
      this.reminders.splice(reminderIdx, 1)
      return true
    }
    return false
  }
}

const createShoppingExecutor = async () => {
  const tools = [
    new DynamicTool({
      name: "amazonSearchTool",
      description: "Use this tool to search for products on Amazon (amazon.com) by keyword or description. Do not change or filter the results. Present them to the user for consideration.",
      func: async (input: string): Promise<string> => {
        console.log(`LLM invoked AMAZON SEARCH TOOL with ${input}`)
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
  })
}

const createBankingExecutor = async () => {
  const tools = [
    new DynamicTool({
      name: "creditCardPaymentTool",
      description: "Make a credit card payment.",
      func: async (input: string): Promise<string> => {
        console.log(`LLM invoked CREDIT CARD PAYMENT TOOL with ${input}`)
        return ""
      },
    }),
  ]

  const llm = new ChatOpenAI({ modelName: "gpt-4" })

  return initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "structured-chat-zero-shot-react-description",
  })
}

const createListExecutor = async () => {
  const tools = [
    new DynamicTool({
      name: "addItemToListTool",
      description: "Add an item to a list.",
      func: async (input: string): Promise<string> => {
        console.log(`LLM invoked ADD ITEM TO LIST TOOL with ${input}`)
        return ""
      },
    }),
  ]

  const llm = new ChatOpenAI({ modelName: "gpt-4" })

  return initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "structured-chat-zero-shot-react-description",
  })
}

const main = async () => {
  const llm = new ChatOpenAI({ modelName: "gpt-4" })
  const reminders = new Reminders()

  const tools = [
    new DynamicTool({
      name: "currentTimeTool",
      description: "Get the current date and time in ISO format",
      func: async (input: string): Promise<string> => {
        return new Date().toISOString()
      },
    }),
    new DynamicStructuredTool({
      name: "addReminderTool",
      description: "Add a reminder",
      schema: z.object({
        description: z.string(),
        date: z.coerce.date().optional().nullable(),
      }),
      func: async ({ description, date }: Omit<Reminder, "id">): Promise<string> => {
        reminders.addReminder(description, date)
        return "reminder added"
      },
    }),
    // TODO update reminder tool
    new DynamicStructuredTool({
      name: "getRemindersTool",
      description: "Get all reminders as a JSON array. Each reminder will have an ID, description, and optional ISO date",
      schema: z.object({}),
      func: async (): Promise<string> => {
        // const parser = StructuredOutputParser.fromZodSchema()

        const json = JSON.stringify(reminders.getReminders())
        return json
      },
    }),
    new DynamicStructuredTool({
      name: "removeReminderTool",
      description: "Remove a reminder",
      schema: z.object({
        id: z.string(),
      }),
      func: async ({ id }): Promise<string> => {
        const result = reminders.removeReminder(id)
        return result ? "reminder removed" : "reminder not found"
      },
    }),
  ]

  const executor = await initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "structured-chat-zero-shot-react-description",
  })

  const cli = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // don't echo input
    prompt: "🧑 ", // default is "> "
  })

  cli.prompt()

  // build a tree of executors
  // the top level executor routes to sub-executors specializing in different domains
  // if a sub-executor is active, and a user makes a request that it doesn't have a tool for, it should pass the request upward

  let currentExecutor: AgentExecutor

  const shoppingExecutor = await createShoppingExecutor()
  const bankingExecutor = await createBankingExecutor()

  const generalExecutor = await (async () => {
    const tools = [
      new DynamicTool({
        name: "switchToShoppingExecutorTool",
        description: "Call this tool if the user wants to do some online shopping. Pass in a summary of the preceding conversation.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked SWITCH TO SHOPPING EXECUTOR TOOL with ${input}`)
          currentExecutor = shoppingExecutor
          return currentExecutor.run(input)
        },
      }),
      new DynamicTool({
        name: "switchToBankingExecutorTool",
        description: "Call this tool if the user wants to do some online banking. Pass in a summary of the preceding conversation.",
        func: async (input: string): Promise<string> => {
          console.log(`LLM invoked SWITCH TO BANKING EXECUTOR TOOL with ${input}`)
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
