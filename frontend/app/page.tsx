"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import {
  createCandidate as createCandidateRequest,
  deleteCandidate as deleteCandidateRequest,
  deleteMessageTemplate,
  getCandidateHistory,
  listCandidates,
  listMessageTemplates,
  retryCommunication,
  saveMessageTemplate,
  sendMessage as sendMessageRequest,
  type ApiCandidate,
  type ApiCommunication,
  type ApiMessageTemplate,
} from "./lib/api";
import { AddCandidateDialog } from "./components/candidates/AddCandidateDialog";
import { CandidateTable } from "./components/candidates/CandidateTable";
import { CandidateToolbar } from "./components/candidates/CandidateToolbar";
import { CommunicationHistoryDrawer } from "./components/candidates/CommunicationHistoryDrawer";
import { DeleteCandidateDialog } from "./components/candidates/DeleteCandidateDialog";
import { MessageTemplateDialog } from "./components/candidates/MessageTemplateDialog";
import { SendMessageDrawer } from "./components/candidates/SendMessageDrawer";
import type { Candidate, CandidateForm, Communication } from "./components/candidates/types";

type Notice = {
  severity: "success" | "error" | "warning" | "info";
  message: string;
};

function formatCandidateDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function mapCandidate(candidate: ApiCandidate): Candidate {
  return {
    id: candidate.id,
    candidateId: candidate.candidate_id,
    name: candidate.name,
    mobile: candidate.mobile,
    email: candidate.email,
    lastMessage: candidate.last_message ? formatCandidateDate(candidate.last_message) : null,
    status: candidate.status,
    communicationHistory: [],
  };
}

function mapCommunication(communication: ApiCommunication): Communication {
  return {
    id: communication.id,
    message: communication.message,
    sentAt: communication.sent_at,
    status: communication.status,
    failureReason: communication.failure_reason || undefined,
    retryable: communication.retryable,
    scheduledAt: communication.scheduled_at,
  };
}

export default function Home() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<ApiMessageTemplate[]>([]);
  const [historyCandidate, setHistoryCandidate] = useState<Candidate | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [retryingCommunicationId, setRetryingCommunicationId] = useState<string | null>(null);
  const historyRequestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [candidateLoadFailed, setCandidateLoadFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    const refreshCandidates = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const items = await listCandidates();
        if (active) {
          setCandidates(items.map(mapCandidate));
          setCandidateLoadFailed(false);
        }
      } catch (error) {
        if (active) {
          setCandidateLoadFailed(true);
          setNotice({
            severity: "error",
            message: error instanceof Error ? error.message : "Could not load candidates.",
          });
        }
      } finally {
        if (active && showLoading) setLoading(false);
      }
    };

    void refreshCandidates(true);
    const interval = window.setInterval(() => void refreshCandidates(false), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listMessageTemplates()
      .then((items) => {
        if (active) setTemplates(items);
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice({
            severity: "error",
            message: error instanceof Error ? error.message : "Could not load message templates.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) =>
      [
        candidate.name,
        candidate.mobile,
        candidate.email,
        candidate.lastMessage ?? "",
        candidate.status ?? "",
        candidate.candidateId,
      ].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [candidates, search]);

  const allVisibleSelected =
    visibleCandidates.length > 0 &&
    visibleCandidates.every((candidate) => selectedIds.includes(candidate.id));
  const someVisibleSelected = visibleCandidates.some((candidate) =>
    selectedIds.includes(candidate.id),
  );
  const selectedCandidates = candidates.filter((candidate) => selectedIds.includes(candidate.id));

  function toggleCandidate(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleCandidates.some((candidate) => candidate.id === id)),
      );
      return;
    }
    setSelectedIds((current) =>
      Array.from(new Set([...current, ...visibleCandidates.map((candidate) => candidate.id)])),
    );
  }

  async function deleteSelected(): Promise<boolean> {
    setDeleting(true);
    const ids = [...selectedIds];
    try {
      const results = await Promise.allSettled(ids.map(deleteCandidateRequest));
      const deletedIds = ids.filter((_, index) => results[index].status === "fulfilled");
      const failures = results.length - deletedIds.length;
      setCandidates((current) => current.filter((candidate) => !deletedIds.includes(candidate.id)));
      setSelectedIds((current) => current.filter((id) => !deletedIds.includes(id)));
      if (failures > 0) {
        setNotice({
          severity: "error",
          message: `Could not delete ${failures} candidate${failures === 1 ? "" : "s"}. Please retry.`,
        });
        return false;
      }
      setNotice({ severity: "success", message: "Candidate(s) deleted." });
      return true;
    } finally {
      setDeleting(false);
    }
  }

  async function sendSelectedMessage(
    message: string,
    scheduledAt: string | null,
    templateId: string | null,
  ) {
    const response = await sendMessageRequest(
      selectedIds,
      message,
      scheduledAt ?? undefined,
      templateId ?? undefined,
    );
    setSelectedIds([]);
    setSendDrawerOpen(false);
    const failed = response.results.filter((result) => !result.success);
    setNotice({
      severity: failed.length ? "warning" : "success",
      message: failed.length
        ? `${response.succeeded} ${scheduledAt ? "scheduled" : "sent"}; ${response.failed} failed. ${failed
            .map((result) => `${result.candidate_name}: ${result.communication.failure_reason}`)
            .join(" ")}`
        : scheduledAt
          ? `Message scheduled for ${response.succeeded} candidate${response.succeeded === 1 ? "" : "s"}.`
          : `Message sent to ${response.succeeded} candidate${response.succeeded === 1 ? "" : "s"}.`,
    });
    try {
      setCandidates((await listCandidates()).map(mapCandidate));
      setCandidateLoadFailed(false);
    } catch (error) {
      setNotice((current) => ({
        severity: "warning",
        message: `${current?.message ?? "Message results saved."} Candidate rows could not be refreshed${
          error instanceof Error ? `: ${error.message}` : "."
        }`,
      }));
    }
  }

  async function addCandidate(form: CandidateForm) {
    const candidate = await createCandidateRequest(form);
    setCandidates((current) => [mapCandidate(candidate), ...current]);
    setCandidateLoadFailed(false);
    setSearch("");
    setNotice({ severity: "success", message: "Candidate added." });
  }

  async function saveTemplate(
    template: { name: string; body: string },
    templateId?: string,
  ) {
    const saved = await saveMessageTemplate(template, templateId);
    setTemplates((current) =>
      [...current.filter(({ id }) => id !== saved.id), saved].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setNotice({
      severity: "success",
      message: templateId ? "Template updated." : "Template created.",
    });
  }

  async function removeTemplate(templateId: string) {
    await deleteMessageTemplate(templateId);
    setTemplates((current) => current.filter(({ id }) => id !== templateId));
    setNotice({ severity: "success", message: "Template deleted." });
  }

  async function openCommunicationHistory(candidate: Candidate) {
    const requestId = ++historyRequestId.current;
    setHistoryCandidate({ ...candidate, communicationHistory: [] });
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const history = await getCandidateHistory(candidate.id);
      if (historyRequestId.current === requestId) {
        setHistoryCandidate({ ...candidate, communicationHistory: history.map(mapCommunication) });
      }
    } catch (error) {
      if (historyRequestId.current === requestId) {
        setHistoryError(
          error instanceof Error ? error.message : "Could not load communication history.",
        );
      }
    } finally {
      if (historyRequestId.current === requestId) setHistoryLoading(false);
    }
  }

  async function retryFailedCommunication(communication: Communication) {
    if (!historyCandidate) return;
    const candidate = historyCandidate;
    setRetryingCommunicationId(communication.id);
    setHistoryError("");
    try {
      const result = await retryCommunication(communication.id);
      setHistoryCandidate((current) =>
        current?.id === candidate.id
          ? {
              ...current,
              communicationHistory: [
                mapCommunication(result.communication),
                ...current.communicationHistory,
              ],
            }
          : current,
      );
      setNotice({
        severity: result.success ? "success" : "warning",
        message: result.success
          ? `Message retried for ${candidate.name}.`
          : result.communication.failure_reason || `Retry failed for ${candidate.name}.`,
      });
      try {
        const [history, updatedCandidates] = await Promise.all([
          getCandidateHistory(candidate.id),
          listCandidates(),
        ]);
        setCandidates(updatedCandidates.map(mapCandidate));
        setCandidateLoadFailed(false);
        setHistoryCandidate((current) =>
          current?.id === candidate.id
            ? { ...current, communicationHistory: history.map(mapCommunication) }
            : current,
        );
      } catch (error) {
        setNotice((current) => ({
          severity: "warning",
          message: `${current?.message ?? "Retry result saved."} History could not be refreshed${
            error instanceof Error ? `: ${error.message}` : "."
          }`,
        }));
      }
    } catch (error) {
      setNotice({
        severity: "error",
        message: error instanceof Error ? error.message : "Could not retry this message.",
      });
    } finally {
      setRetryingCommunicationId(null);
    }
  }

  function closeCommunicationHistory() {
    historyRequestId.current += 1;
    setHistoryCandidate(null);
    setHistoryError("");
    setHistoryLoading(false);
  }

  return (
    <Box component="main" sx={{ backgroundColor: "#f2f2f2", minHeight: "100dvh" }}>
      <CandidateToolbar
        onAddCandidate={() => setAddDialogOpen(true)}
        onDeleteCandidates={() => setDeleteDialogOpen(true)}
        onManageTemplates={() => setTemplateDialogOpen(true)}
        onSearchChange={setSearch}
        onSendMessage={() => setSendDrawerOpen(true)}
        search={search}
        selectedCount={selectedIds.length}
      />
      {notice && (
        <Alert onClose={() => setNotice(null)} severity={notice.severity} sx={{ mx: 1, mt: 1 }}>
          {notice.message}
        </Alert>
      )}
      <CandidateTable
        allVisibleSelected={allVisibleSelected}
        candidates={visibleCandidates}
        loadFailed={candidateLoadFailed}
        loading={loading}
        onToggleAllVisible={toggleAllVisible}
        onToggleCandidate={toggleCandidate}
        onViewHistory={(candidate) => void openCommunicationHistory(candidate)}
        search={search}
        selectedIds={selectedIds}
        someVisibleSelected={someVisibleSelected}
        totalCandidateCount={candidates.length}
      />
      <AddCandidateDialog
        onAdd={addCandidate}
        onClose={() => setAddDialogOpen(false)}
        open={addDialogOpen}
      />
      <DeleteCandidateDialog
        candidates={selectedCandidates}
        deleting={deleting}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={async () => {
          if (await deleteSelected()) setDeleteDialogOpen(false);
        }}
        open={deleteDialogOpen}
      />
      <SendMessageDrawer
        onClose={() => setSendDrawerOpen(false)}
        onSend={sendSelectedMessage}
        open={sendDrawerOpen}
        recipients={selectedCandidates}
        templates={templates}
      />
      <MessageTemplateDialog
        onClose={() => setTemplateDialogOpen(false)}
        onDelete={removeTemplate}
        onSave={saveTemplate}
        open={templateDialogOpen}
        templates={templates}
      />
      <CommunicationHistoryDrawer
        candidate={historyCandidate}
        error={historyError}
        loading={historyLoading}
        onClose={closeCommunicationHistory}
        onRetry={(communication) => void retryFailedCommunication(communication)}
        retryingId={retryingCommunicationId}
      />
    </Box>
  );
}
