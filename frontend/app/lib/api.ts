export type ApiCandidate = {
  id: string;
  candidate_id: string;
  name: string;
  mobile: string;
  email: string;
  last_message: string | null;
  status: "Scheduled" | "Sent" | "Delivered" | "Read" | "Failed" | null;
};

export type ApiCommunication = {
  id: string;
  message: string;
  sent_at: string;
  status: "Scheduled" | "Sent" | "Delivered" | "Read" | "Failed";
  failure_reason: string;
  retryable: boolean;
  scheduled_at: string | null;
};

export type ApiMessageTemplate = {
  id: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type SendResult = {
  candidate_id: string;
  candidate_name: string;
  communication: ApiCommunication;
  success: boolean;
  retryable: boolean;
};

type SendResponse = {
  results: SendResult[];
  succeeded: number;
  failed: number;
};

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("The server could not be reached. Check that the backend is running.");
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(readApiError(body) ?? `The request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function readApiError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  return findErrorMessage(record.error) ?? findErrorMessage(record.detail) ??
    findErrorMessage(record);
}

function findErrorMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = findErrorMessage(item);
      if (message) return message;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message = findErrorMessage(record.message) ?? findErrorMessage(record.detail);
    if (message) return message;
    for (const nested of Object.values(record)) {
      const nestedMessage = findErrorMessage(nested);
      if (nestedMessage) return nestedMessage;
    }
  }
  return null;
}

export function listCandidates(search = ""): Promise<ApiCandidate[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<ApiCandidate[]>(`candidates/${query}`);
}

export function createCandidate(candidate: {
  name: string;
  mobile: string;
  email: string;
}): Promise<ApiCandidate> {
  return request<ApiCandidate>("candidates/", {
    method: "POST",
    body: JSON.stringify(candidate),
  });
}

export function deleteCandidate(candidateId: string): Promise<void> {
  return request<void>(`candidates/${encodeURIComponent(candidateId)}/`, {
    method: "DELETE",
  });
}

export function getCandidateHistory(candidateId: string): Promise<ApiCommunication[]> {
  return request<ApiCommunication[]>(
    `candidates/${encodeURIComponent(candidateId)}/history/`,
  );
}

export function sendMessage(
  candidateIds: string[],
  message: string,
  scheduledAt?: string,
  templateId?: string,
): Promise<SendResponse> {
  return request<SendResponse>("communications/send/", {
    method: "POST",
    body: JSON.stringify({
      candidate_ids: candidateIds,
      ...(templateId ? { template_id: templateId } : { message }),
      ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    }),
  });
}

export function retryCommunication(
  communicationId: string,
): Promise<{ communication: ApiCommunication; success: boolean; retryable: boolean }> {
  return request(`communications/${encodeURIComponent(communicationId)}/retry/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listMessageTemplates(): Promise<ApiMessageTemplate[]> {
  return request<ApiMessageTemplate[]>("templates/");
}

export function saveMessageTemplate(
  template: { name: string; body: string },
  templateId?: string,
): Promise<ApiMessageTemplate> {
  return request<ApiMessageTemplate>(
    templateId ? `templates/${encodeURIComponent(templateId)}/` : "templates/",
    {
      method: templateId ? "PUT" : "POST",
      body: JSON.stringify(template),
    },
  );
}

export function deleteMessageTemplate(templateId: string): Promise<void> {
  return request<void>(`templates/${encodeURIComponent(templateId)}/`, {
    method: "DELETE",
  });
}
