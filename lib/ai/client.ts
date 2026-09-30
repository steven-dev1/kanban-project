"use client";

import type { AiIntent, AiPayload } from "@/lib/ai/prompts";

export interface ExtractedCase {
  title: string;
  description?: string | null;
  assignee_email?: string | null;
  assignee_name?: string | null;
  priority?: "alta" | "media" | "baja" | null;
  due_date?: string | null;
  list?: string | null;
  confidence?: number;
}

export interface AiDocumentResponse {
  description: string;
  functional_description: string;
}

interface RawResponse {
  ok?: boolean;
  error?: string;
  text?: string;
  description?: string;
  functional_description?: string;
  cases?: ExtractedCase[];
}

async function post(intent: AiIntent, payload: AiPayload): Promise<RawResponse> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, payload }),
  });
  const data = (await response.json().catch(() => ({}))) as RawResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error ?? "No se pudo usar la IA.");
  }
  return data;
}

export async function aiExplain(payload: AiPayload): Promise<string> {
  return (await post("explain", payload)).text ?? "";
}

export async function aiSummarize(payload: AiPayload): Promise<string> {
  return (await post("summarize", payload)).text ?? "";
}

export async function aiDiagnose(payload: AiPayload): Promise<string> {
  return (await post("diagnose", payload)).text ?? "";
}

export async function aiDiffExplain(payload: AiPayload): Promise<string> {
  return (await post("diff-explain", payload)).text ?? "";
}

export async function aiDocument(payload: AiPayload): Promise<AiDocumentResponse> {
  const data = await post("document", payload);
  return {
    description: data.description ?? "",
    functional_description: data.functional_description ?? "",
  };
}

export async function aiExtractCases(payload: AiPayload): Promise<ExtractedCase[]> {
  const data = await post("extract-cases", payload);
  return data.cases ?? [];
}
