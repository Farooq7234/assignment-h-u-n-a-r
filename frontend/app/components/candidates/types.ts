export type Communication = {
  id: string;
  message: string;
  sentAt: string;
  status: "Scheduled" | "Sent" | "Delivered" | "Read" | "Failed";
  failureReason?: string;
  retryable?: boolean;
  scheduledAt?: string | null;
};

export type Candidate = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  lastMessage: string | null;
  status: "Scheduled" | "Read" | "Delivered" | "Failed" | "Sent" | null;
  candidateId: string;
  communicationHistory: Communication[];
};

export type CandidateForm = Pick<Candidate, "name" | "mobile" | "email">;
