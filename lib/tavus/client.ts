const TAVUS_BASE_URL = "https://tavusapi.com";

export class TavusError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    throw new Error("TAVUS_API_KEY is not set");
  }

  const res = await fetch(`${TAVUS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new TavusError(res.status, body, `Tavus ${res.status} on ${path}`);
  }
  return body as T;
}

export type CreatePersonaInput = {
  persona_name: string;
  system_prompt: string;
  context?: string;
  default_replica_id?: string;
  layers?: Record<string, unknown>;
};

export type CreatePersonaResponse = {
  persona_id: string;
  persona_name: string;
};

export type CreateConversationInput = {
  persona_id: string;
  conversation_name?: string;
  conversational_context?: string;
  custom_greeting?: string;
  properties?: Record<string, unknown>;
  callback_url?: string;
};

export type CreateConversationResponse = {
  conversation_id: string;
  conversation_url: string;
  status: string;
};

export const tavus = {
  createPersona(input: CreatePersonaInput) {
    return request<CreatePersonaResponse>("/v2/personas", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updatePersona(id: string, patch: Record<string, unknown>) {
    return request<CreatePersonaResponse>(`/v2/personas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  getPersona(id: string) {
    return request<unknown>(`/v2/personas/${id}`);
  },
  createConversation(input: CreateConversationInput) {
    return request<CreateConversationResponse>("/v2/conversations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  endConversation(id: string) {
    return request<unknown>(`/v2/conversations/${id}/end`, { method: "POST" });
  },
};
