/**
 * Execution client contract and HTTP implementation.
 *
 * The workspace calls this client.
 * Monaco editor does not.
 * API URL details are contained here, not spread across components.
 */

export interface ExecutionRequest {
  languageId: string;
  source: string;
}

export interface ExecutionClient {
  execute(request: ExecutionRequest): Promise<unknown>;
}

export class HttpExecutionClient implements ExecutionClient {
  constructor(private readonly baseUrl: string = "http://localhost:8000") {}

  async execute(request: ExecutionRequest): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/v1/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `Execution API returned ${response.status}: ${response.statusText}`,
      );
    }

    const body = await response.json();
    return body.trace;
  }
}