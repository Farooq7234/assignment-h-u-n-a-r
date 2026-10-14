import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  Typography,
} from "@mui/material";
import { candidateAsset } from "./assets";
import type { Candidate, Communication } from "./types";

type CommunicationHistoryDrawerProps = {
  candidate: Candidate | null;
  error: string;
  loading: boolean;
  onClose: () => void;
  onRetry: (communication: Communication) => void;
  retryingId: string | null;
};

const historyStatusStyles: Record<
  Communication["status"],
  { background: string; color: string }
> = {
  Scheduled: { background: "#fff3e0", color: "#e65100" },
  Sent: { background: "#e3f2fd", color: "#1565c0" },
  Delivered: { background: "#e8f5e9", color: "#2e7d32" },
  Read: { background: "#e8f5e9", color: "#2e7d32" },
  Failed: { background: "#feebee", color: "#c62828" },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h12",
});

function formatCommunicationDate(value: string): string {
  const date = new Date(value);
  return `${dateFormatter.format(date)} | ${timeFormatter.format(date)}`;
}

export function CommunicationHistoryDrawer({
  candidate,
  error,
  loading,
  onClose,
  onRetry,
  retryingId,
}: CommunicationHistoryDrawerProps) {
  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={candidate !== null}
      sx={{
        "& .MuiBackdrop-root": { backgroundColor: "rgba(0, 0, 0, 0.12)" },
        "& .MuiDrawer-paper": {
          backgroundColor: "#fff",
          boxSizing: "border-box",
          height: "100dvh",
          maxWidth: "100vw",
          overflow: "hidden",
          width: 660,
          boxShadow: "-2px 0 12px rgba(0, 0, 0, 0.16)",
        },
      }}
    >
      {candidate && (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ px: 5, pt: 5 }}>
            <Box
              sx={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Typography
                component="h2"
                id="communication-history-title"
                sx={{
                  color: "#000",
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                Communication History
              </Typography>
              <Button
                aria-label="Close communication history"
                onClick={onClose}
                sx={{ height: 24, minWidth: 24, p: 0, width: 24 }}
              >
                <Box
                  alt=""
                  component="img"
                  src={candidateAsset("close")}
                  sx={{ height: 24, width: 24 }}
                />
              </Button>
            </Box>

            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 4, borderBottom: "1px solid #e0e0e0", py:'3' }}
            >
              <Typography sx={{ color: "#666", fontSize: 14 }}>
                Candidate ID: {candidate.candidateId}
              </Typography>
              <Typography
                sx={{
                  color: "#000",
                  fontSize: 24,
                  fontWeight: 700,
                  lineHeight: 1.3,
                }}
              >
                {candidate.name}
              </Typography>

              <Typography sx={{ color: "#222", fontSize: 15, fontWeight: 500 }}>
                {candidate.mobile}
              </Typography>

              {candidate.email && (
                <Typography
                  sx={{ color: "#222", fontSize: 15, fontWeight: 500 }}
                >
                  {candidate.email}
                </Typography>
              )}
            </Box>
          </Box>

          {/* <Divider  sx={{ mt: 3 }} /> */}
          <Box
            aria-label={`Communication history for ${candidate.name}`}
            sx={{ flex: 1, overflowY: "auto", px: 5 }}
          >
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
                <CircularProgress aria-label="Loading communication history" />
              </Box>
            ) : error ? (
              <Typography role="alert" sx={{ color: "#c62828", mt: 4 }}>
                {error}
              </Typography>
            ) : candidate.communicationHistory.length > 0 ? (
              [...candidate.communicationHistory]
                .sort(
                  (first, second) =>
                    Date.parse(second.sentAt) - Date.parse(first.sentAt),
                )
                .map((communication, index, communications) => (
                  <Box
                    key={communication.id}
                    sx={{
                      borderBottom:
                        index < communications.length - 1
                          ? "1px solid #e0e0e0"
                          : 0,
                      py: 3,
                    }}
                  >
                    <Box
                      sx={{
                        alignItems: "center",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        component="time"
                        dateTime={
                          communication.status === "Scheduled" &&
                          communication.scheduledAt
                            ? communication.scheduledAt
                            : communication.sentAt
                        }
                        sx={{
                          color: "rgba(0, 0, 0, 0.6)",
                          fontSize: 14,
                        }}
                      >
                        {formatCommunicationDate(
                          communication.status === "Scheduled" &&
                            communication.scheduledAt
                            ? communication.scheduledAt
                            : communication.sentAt,
                        )}
                      </Typography>
                      <Chip
                        label={communication.status}
                        size="small"
                        sx={{
                          backgroundColor:
                            historyStatusStyles[communication.status]
                              .background,
                          color:
                            historyStatusStyles[communication.status].color,
                          flexShrink: 0,
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      />
                    </Box>

                    <Typography
                      sx={{
                        color: "#212121",
                        fontSize: 16,
                        lineHeight: 1.5,
                        overflowWrap: "anywhere",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {communication.message}
                    </Typography>
                    <Box
                      sx={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1,
                        mt: 2,
                      }}
                    >
                      {communication.failureReason && (
                        <Typography
                          sx={{
                            color: "#c62828",
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          {communication.failureReason}
                        </Typography>
                      )}
                      {communication.status === "Failed" &&
                        communication.retryable && (
                          <Button
                            disabled={retryingId !== null}
                            onClick={() => onRetry(communication)}
                            size="small"
                            variant="outlined"
                          >
                            {retryingId === communication.id ? (
                              <CircularProgress
                                aria-label="Retrying message"
                                size={16}
                              />
                            ) : (
                              "Retry"
                            )}
                          </Button>
                        )}
                    </Box>
                  </Box>
                ))
            ) : (
              <Box
                sx={{
                  alignItems: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  mt: 8,
                  textAlign: "center",
                }}
              >
                <Typography
                  sx={{ color: "#212121", fontSize: 16, fontWeight: 600 }}
                >
                  No communication history
                </Typography>
                <Typography sx={{ color: "rgba(0, 0, 0, 0.6)", fontSize: 14 }}>
                  Messages sent to this candidate will appear here.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
