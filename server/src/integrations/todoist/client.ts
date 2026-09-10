import { env } from "../../config/env";

export class TodoistApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Todoist API error (${status}): ${body}`);
  }
}

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  url: string;
}

export async function createTodoistTask(input: {
  content: string;
  description?: string;
  dueString?: string;
}): Promise<TodoistTask> {
  if (!env.todoistApiToken) {
    throw new Error("TODOIST_API_TOKEN is not configured");
  }

  const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.todoistApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.content,
      description: input.description,
      due_string: input.dueString,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new TodoistApiError(response.status, bodyText);
  }

  return JSON.parse(bodyText) as TodoistTask;
}
