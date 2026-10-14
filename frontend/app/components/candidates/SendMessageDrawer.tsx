"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import { candidateAsset } from "./assets";
import type { Candidate } from "./types";
import type { ApiMessageTemplate } from "../../lib/api";

type SendMessageDrawerProps = {
  open: boolean;
  recipients: Candidate[];
  templates: ApiMessageTemplate[];
  onClose: () => void;
  onSend: (
    message: string,
    scheduledAt: string | null,
    templateId: string | null,
  ) => Promise<void>;
};

const recipientChipSx = {
  backgroundColor: "#eceff1",
  borderRadius: "100px",
  flexShrink: 0,
  height: 32,
  "& .MuiChip-label": {
    fontFamily: "Roboto, Arial, sans-serif",
    fontSize: 13,
    letterSpacing: "0.16px",
    lineHeight: "18px",
    px: "10px",
  },
};

const overflowLabelSx = {
  color: "rgba(0, 0, 0, 0.87)",
  fontFamily: "Roboto, Arial, sans-serif",
  fontSize: 13,
  letterSpacing: "0.16px",
  lineHeight: "18px",
  whiteSpace: "nowrap",
};

export function SendMessageDrawer({
  open,
  recipients,
  templates,
  onClose,
  onSend,
}: SendMessageDrawerProps) {
  const [message, setMessage] = useState("This is just a test message.");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Dayjs | null>(null);
  const [currentTime, setCurrentTime] = useState<Dayjs | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const recipientContainerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const recipientKey = recipients.map(({ id }) => id).join(",");
  const [measuredRecipients, setMeasuredRecipients] = useState({
    key: recipientKey,
    count: recipients.length,
  });
  const visibleRecipientCount =
    measuredRecipients.key === recipientKey ? measuredRecipients.count : recipients.length;
  const selectedTemplate = templates.find(({ id }) => id === selectedTemplateId);
  const templatePreview = selectedTemplate && recipients[0]
    ? selectedTemplate.body
        .replaceAll("{{name}}", recipients[0].name)
        .replaceAll("{{phone}}", recipients[0].mobile)
        .replaceAll("{{email}}", recipients[0].email)
    : "";
  const hasMessage = selectedTemplate ? Boolean(selectedTemplateId) : Boolean(message.trim());

  useEffect(() => {
    if (!open) return;

    const updateCurrentTime = () => setCurrentTime(dayjs());
    const timeout = window.setTimeout(updateCurrentTime, 0);
    const interval = window.setInterval(updateCurrentTime, 30_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [open]);

  const scheduleError = scheduledAt
    ? !scheduledAt.isValid()
      ? "Enter a valid date and time."
      : !currentTime || !scheduledAt.isAfter(currentTime.add(1, "minute"))
        ? "Choose a time at least one minute in the future."
        : scheduledAt.isAfter(currentTime.add(30, "day"))
          ? "Emails can only be scheduled up to 30 days ahead."
          : ""
    : "";

  useLayoutEffect(() => {
    if (!open) return;

    const container = recipientContainerRef.current;
    const measurement = measurementRef.current;
    if (!container || !measurement) return;

    const updateVisibleRecipientCount = () => {
      const availableWidth = container.clientWidth;
      const chipWidths = Array.from(
        measurement.querySelectorAll<HTMLElement>("[data-recipient-chip]"),
      ).map((chip) => chip.getBoundingClientRect().width);
      const overflowWidths = new Map(
        Array.from(measurement.querySelectorAll<HTMLElement>("[data-overflow-count]")).map(
          (label) => [Number(label.dataset.overflowCount), label.getBoundingClientRect().width],
        ),
      );
      if (availableWidth === 0 || chipWidths.length !== recipients.length) return;

      const fitsInTwoLines = (count: number) => {
        const widths = chipWidths.slice(0, count);
        if (count < recipients.length) {
          const overflowWidth = overflowWidths.get(recipients.length - count);
          if (overflowWidth === undefined) return false;
          widths.push(overflowWidth);
        }

        let line = 1;
        let lineWidth = 0;
        for (const width of widths) {
          const nextWidth = lineWidth === 0 ? width : lineWidth + 8 + width;
          if (nextWidth > availableWidth) {
            line += 1;
            lineWidth = width;
          } else {
            lineWidth = nextWidth;
          }
          if (line > 2) return false;
        }
        return true;
      };

      let count = recipients.length;
      while (count > 0 && !fitsInTwoLines(count)) count -= 1;
      setMeasuredRecipients((current) =>
        current.key === recipientKey && current.count === count
          ? current
          : { key: recipientKey, count },
      );
    };

    const observer = new ResizeObserver(updateVisibleRecipientCount);
    observer.observe(container);
    const frame = requestAnimationFrame(updateVisibleRecipientCount);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open, recipientKey, recipients.length]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (
      !hasMessage ||
      recipients.length === 0 ||
      sending ||
      (scheduledAt && (!scheduledAt.isValid() || !scheduledAt.isAfter(dayjs().add(1, "minute"))))
    ) return;
    setSending(true);
    setSendError("");
    try {
      await onSend(
        selectedTemplate ? "" : trimmedMessage,
        scheduledAt?.toISOString() ?? null,
        selectedTemplate?.id ?? null,
      );
      setScheduledAt(null);
      setSelectedTemplateId("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={open}
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
      <Box
        component="form"
        onSubmit={submitMessage}
        sx={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 5, pt: 5, pb: 3 }}>
          <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <Typography
              component="h2"
              id="send-message-title"
              sx={{ color: "#000", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
            >
              Send Message
            </Typography>
            <Button
              aria-label="Close"
              onClick={onClose}
              sx={{ height: 24, minWidth: 24, p: 0, width: 24 }}
            >
              <Box alt="" component="img" src={candidateAsset("close")} sx={{ height: 24, width: 24 }} />
            </Button>
          </Box>
          {sendError && <Alert severity="error" sx={{ mt: 2 }}>{sendError}</Alert>}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 4 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={{ color: "#212121", fontSize: 16, lineHeight: 1.35 }}>
                {recipients.length} {recipients.length === 1 ? "Recipient" : "Recipients"}
              </Typography>
              <Box
                aria-label={`${recipients.length} recipients`}
                ref={recipientContainerRef}
                role="list"
                sx={{
                  alignContent: "flex-start",
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  maxHeight: 72,
                  overflow: "hidden",
                }}
              >
                {recipients.slice(0, visibleRecipientCount).map((candidate) => (
                  <Chip
                    key={candidate.id}
                    label={candidate.name}
                    role="listitem"
                    sx={recipientChipSx}
                  />
                ))}
                {visibleRecipientCount < recipients.length && (
                  <Typography role="listitem" sx={overflowLabelSx}>
                    + {recipients.length - visibleRecipientCount}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={{ color: "#212121", fontSize: 16, lineHeight: 1.35 }}>
                Schedule send <Box component="span" sx={{ color: "rgba(0,0,0,0.6)", fontSize: 13 }}>(optional)</Box>
              </Typography>
              <Typography sx={{ color: "rgba(0,0,0,0.6)", fontSize: 12 }}>
                Leave empty to send now. Resend supports scheduling up to 30 days ahead.
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  label="Date and time"
                  disabled={!currentTime}
                  maxDateTime={currentTime?.add(30, "day")}
                  minDateTime={currentTime?.add(1, "minute")}
                  onChange={setScheduledAt}
                  slotProps={{
                    textField: {
                      error: Boolean(scheduleError),
                      fullWidth: true,
                      helperText: scheduleError,
                      size: "small",
                    },
                  }}
                  value={scheduledAt}
                />
              </LocalizationProvider>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <TextField
                fullWidth
                label="Message type"
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                select
                size="small"
                value={selectedTemplateId}
              >
                <MenuItem value="">Write a one-off message</MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </TextField>
              {selectedTemplate && (
                <Alert severity="info">
                  Preview for {recipients[0]?.name}. Each recipient receives their own personalized values.
                </Alert>
              )}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <Typography sx={{ color: "#212121", fontSize: 16, lineHeight: 1.35 }}>
                  {selectedTemplate ? "Template preview" : "Message"}{" "}
                  <Box component="span" sx={{ color: "#c62828" }}>*</Box>
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(0, 0, 0, 0.6)",
                    fontFamily: "Roboto, Arial, sans-serif",
                    fontSize: 12,
                    letterSpacing: "0.4px",
                    lineHeight: 1.66,
                  }}
                >
                  {selectedTemplate
                    ? "Candidate details are filled in automatically for each recipient."
                    : "Type, or paste the message you want to send."}
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                onChange={selectedTemplate ? undefined : (event) => setMessage(event.target.value)}
                placeholder={selectedTemplate ? "" : "Write your message"}
                slotProps={{
                  htmlInput: {
                    "aria-label": selectedTemplate ? "Template preview" : "Message",
                    readOnly: Boolean(selectedTemplate),
                  },
                }}
                rows={7}
                value={selectedTemplate ? templatePreview : message}
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    alignItems: "flex-start",
                    borderRadius: "4px",
                    height: 200,
                    p: 0,
                  },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#bdbdbd" },
                  "& .MuiInputBase-inputMultiline": {
                    boxSizing: "border-box",
                    height: "100% !important",
                    lineHeight: "24px",
                    overflow: "auto !important",
                    p: "16px 12px",
                  },
                }}
              />
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            alignItems: "center",
            borderTop: "1px solid #eee",
            display: "flex",
            gap: 1.5,
            justifyContent: "flex-end",
            mt: "auto",
            minHeight: 96,
            px: 5,
          }}
        >
          <Button disabled={sending} onClick={onClose} type="button" variant="outlined">
            Cancel
          </Button>
          <Button
            disabled={
              !hasMessage ||
              recipients.length === 0 ||
              sending ||
              Boolean(scheduleError)
            }
            type="submit"
            variant="contained"
          >
            {sending ? (
              <CircularProgress color="inherit" size={18} />
            ) : scheduledAt ? (
              "Schedule Message"
            ) : (
              "Send Message"
            )}
          </Button>
        </Box>
      </Box>

      <Box
        aria-hidden="true"
        ref={measurementRef}
        sx={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 1,
          left: -10000,
          position: "fixed",
          top: 0,
          visibility: "hidden",
          width: "max-content",
        }}
      >
        {recipients.map((candidate) => (
          <Chip
            key={candidate.id}
            data-recipient-chip
            label={candidate.name}
            sx={recipientChipSx}
          />
        ))}
        {recipients.map((_, index) => {
          const overflowCount = index + 1;
          return (
            <Box
              component="span"
              data-overflow-count={overflowCount}
              key={overflowCount}
              sx={overflowLabelSx}
            >
              + {overflowCount}
            </Box>
          );
        })}
      </Box>
    </Drawer>
  );
}
