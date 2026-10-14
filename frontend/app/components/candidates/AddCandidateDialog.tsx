"use client";

import { useState, type FormEvent } from "react";
import { Box, Button, CircularProgress, Dialog, TextField, Typography } from "@mui/material";
import { candidateAsset } from "./assets";
import type { CandidateForm } from "./types";

const blankCandidateForm: CandidateForm = { name: "", mobile: "", email: "" };

type AddCandidateDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (candidate: CandidateForm) => Promise<void>;
};

export function AddCandidateDialog({ open, onClose, onAdd }: AddCandidateDialogProps) {
  const [form, setForm] = useState(blankCandidateForm);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [touched, setTouched] = useState({ name: false, mobile: false, email: false });
  const [submitted, setSubmitted] = useState(false);
  const nameError = form.name.trim() ? "" : "Candidate name is required.";
  const phoneDigits = form.mobile.replace(/\D/g, "");
  const mobileError = !form.mobile.trim()
    ? "Mobile number is required."
    : !/^\+?[0-9\s().-]+$/.test(form.mobile.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15
      ? "Enter a valid phone number with 7 to 15 digits."
      : "";
  const emailError = !form.email.trim()
    ? "Email is required."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
      ? "Enter a valid email address."
      : "";
  const canSubmit = !nameError && !mobileError && !emailError;

  function closeDialog() {
    if (submitting) return;
    setSubmissionError("");
    setForm(blankCandidateForm);
    setTouched({ name: false, mobile: false, email: false });
    setSubmitted(false);
    onClose();
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmissionError("");
    try {
      await onAdd({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
      });
      setForm(blankCandidateForm);
      setTouched({ name: false, mobile: false, email: false });
      setSubmitted(false);
      onClose();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Could not add candidate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      aria-labelledby="add-candidate-title"
      maxWidth={false}
      onClose={closeDialog}
      open={open}
      sx={{
        "& .MuiBackdrop-root": { backgroundColor: "rgba(0, 0, 0, 0.05)" },
        "& .MuiDialog-container": { p: 2 },
        "& .MuiDialog-paper": {
          border: "1px solid #bdbdbd",
          borderRadius: 0,
          boxShadow: "-2px 0 12px rgba(0, 0, 0, 0.16)",
          boxSizing: "border-box",
          height: 500,
          maxHeight: "calc(100% - 32px)",
          maxWidth: "calc(100% - 32px)",
          m: 0,
          overflow: "hidden",
          width: 600,
        },
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={submitForm}
        sx={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Box sx={{ px: 5, pt: 5 }}>
          <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <Typography
              component="h2"
              id="add-candidate-title"
              sx={{ color: "#000", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
            >
              Add Candidate
            </Typography>
            <Button
              aria-label="Close"
              onClick={closeDialog}
              sx={{ height: 24, minWidth: 24, p: 0, width: 24 }}
            >
              <Box alt="" component="img" src={candidateAsset("close")} sx={{ height: 24, width: 24 }} />
            </Button>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 4, mt: 6 }}>
            <TextField
              autoFocus
              error={(touched.name || submitted) && Boolean(nameError)}
              fullWidth
              helperText={(touched.name || submitted) ? nameError : ""}
              label="Candidate Name"
              onBlur={() => setTouched((current) => ({ ...current, name: true }))}
              onChange={(event) => {
                setSubmissionError("");
                setForm((current) => ({ ...current, name: event.target.value }));
              }}
              required
              value={form.name}
              variant="outlined"
            />
            <TextField
              error={(touched.mobile || submitted) && Boolean(mobileError)}
              fullWidth
              helperText={(touched.mobile || submitted) ? mobileError : ""}
              label="Mobile Number"
              onBlur={() => setTouched((current) => ({ ...current, mobile: true }))}
              onChange={(event) => {
                setSubmissionError("");
                setForm((current) => ({ ...current, mobile: event.target.value }));
              }}
              required
              slotProps={{ htmlInput: { inputMode: "tel", maxLength: 24 } }}
              type="tel"
              value={form.mobile}
              variant="outlined"
            />
            <TextField
              error={(touched.email || submitted) && Boolean(emailError)}
              fullWidth
              helperText={(touched.email || submitted) ? emailError : ""}
              label="Email"
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              onChange={(event) => {
                setSubmissionError("");
                setForm((current) => ({ ...current, email: event.target.value }));
              }}
              required
              type="email"
              value={form.email}
              variant="outlined"
            />
          </Box>
          {submissionError && (
            <Typography role="alert" sx={{ color: "#c62828", fontSize: 14, mt: 2 }}>
              {submissionError}
            </Typography>
          )}
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
          <Button disabled={submitting} onClick={closeDialog} variant="outlined">
            Cancel
          </Button>
          <Button disabled={!canSubmit || submitting} type="submit" variant="contained">
            {submitting ? <CircularProgress color="inherit" size={18} /> : "Add Candidate"}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
