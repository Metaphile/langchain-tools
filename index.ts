import { ChatOpenAI } from "langchain/chat_models/openai"
import { initializeAgentExecutorWithOptions } from "langchain/agents"
import { DynamicTool, DynamicStructuredTool } from "langchain/tools"
import { createInterface } from "readline"
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

  for await (const input of cli) {
    const result = await executor.run(input)
    console.log(`🤖 ${result}`)
    cli.prompt()
  }
}

main()
