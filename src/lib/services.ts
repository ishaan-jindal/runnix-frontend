import api from "./api";
import type {
  JobStatus,
  Language,
  Job,
  SubmitResponse,
  JobsResponse,
} from "./types";

// Re-export types for convenience
export type { JobStatus, Language, Job, SubmitResponse, JobsResponse };

/* ─── Auth ─── */

export const authService = {
  register: (username: string, email: string, password: string) =>
    api.post("/auth/register", { username, email, password }),

  login: (credentials: {
    username?: string;
    email?: string;
    password: string;
  }) => api.post("/auth/login", credentials),

  me: () => api.get("/auth/me"),

  updateProfile: (_payload: { username: string; email: string }) =>
    api.patch("/auth/me", _payload),

  changePassword: (_payload: { currentPassword: string; newPassword: string }) =>
    api.post("/auth/change-password", _payload),

  deleteMe: () =>
    api.delete("/auth/me"),

  logoutAll: () => api.post("/auth/logout-all"),

  generateApiKey: (name: string) =>
    api.post("/auth/api-keys", { name }),

  listApiKeys: () => api.get("/auth/api-keys"),

  revokeApiKey: (keyId: string) =>
    api.delete(`/auth/api-keys/${keyId}`),
};

/* ─── Code Execution ─── */

export const executionService = {
  /**
   * Submit code for execution.
   * Uses `inputs` array as the API expects, NOT the deprecated `stdin` field.
   */
  submit: (language: Language, code: string, stdin?: string) =>
    api.post<{ success: boolean; data: SubmitResponse }>("/submit", {
      language,
      code,
      ...(stdin ? { inputs: [stdin] } : {}),
    }),

  getResult: (jobId: string) =>
    api.get<{ success: boolean; data: Job }>(`/result/${jobId}`),

  getJobCode: (jobId: string) =>
    api.get(`/jobs/${jobId}/code`),

  listJobs: (params?: {
    status?: JobStatus;
    language?: Language;
    limit?: number;
    offset?: number;
  }) =>
    api.get<{ success: boolean; data: JobsResponse }>("/jobs", { params }),
};

/* ─── Webhooks ─── */

export const webhookService = {
  create: (url: string, events: string[], secret?: string) =>
    api.post("/webhooks", { url, events, ...(secret ? { secret } : {}) }),

  list: () => api.get("/webhooks"),

  get: (id: string) => api.get(`/webhooks/${id}`),

  getDeliveries: (id: string) => api.get(`/webhooks/${id}/deliveries`),

  delete: (id: string) => api.delete(`/webhooks/${id}`),
};

/* ─── Admin ─── */

export const adminService = {
  listUsers: (page = 0, limit = 20) =>
    api.get("/admin/users", { params: { limit, offset: page * limit } }),

  getUser: (userId: string) =>
    api.get(`/admin/users/${userId}`),

  upgradeUser: (userId: string, newTier: string) =>
    api.post(`/admin/users/${userId}/upgrade`, { newTier }),

  makeAdmin: (userId: string) =>
    api.post(`/admin/users/${userId}/make-admin`),

  revokeAdmin: (userId: string) =>
    api.post(`/admin/users/${userId}/revoke-admin`),

  deleteUser: (userId: string) =>
    api.delete(`/admin/users/${userId}`),
};

/* ─── Public / Unauthenticated ─── */

export const publicService = {
  languages: () => api.get("/languages"),
  language: (lang: string) => api.get(`/languages/${lang}`),
  health: () => api.get("/health"),
  status: () => api.get("/status"),
};
