"use client";

import {
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type SyntheticEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import type { ApiMessageTemplate } from "../../lib/api";

type MessageTemplateDialogProps = {
  open: boolean;
  templates: ApiMessageTemplate[];
  onClose: () => void;
  onSave: (
    template: { name: string; body: string },
    templateId?: string,
  ) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
};

export function MessageTemplateDialog({
  open,
  templates,
  onClose,
  onSave,
  onDelete,
}: MessageTemplateDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiMessageTemplate | null>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const bodySelection = useRef({ start: 0, end: 0 });

  function closeDialog() {
    if (saving) return;
    startNewTemplate();
    setDeleteTarget(null);
    onClose();
  }

  function startEditing(template: ApiMessageTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setBody(template.body);
    setError("");
  }

  function startNewTemplate() {
    setEditingId(null);
    setName("");
    setBody("");
    setError("");
    bodySelection.current = { start: 0, end: 0 };
  }

  function insertPlaceholder(placeholder: string) {
    const input = bodyInputRef.current;
    const start = input?.selectionStart ?? bodySelection.current.start;
    const end = input?.selectionEnd ?? bodySelection.current.end;
    const nextBody = `${body.slice(0, start)}${placeholder}${body.slice(end)}`;
    const caret = start + placeholder.length;

    setBody(nextBody);
    bodySelection.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      bodyInputRef.current?.focus();
      bodyInputRef.current?.setSelectionRange(caret, caret);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !body.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), body: body.trim() }, editingId ?? undefined);
      startNewTemplate();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setError("");
    try {
      await onDelete(deleteTarget.id);
      if (editingId === deleteTarget.id) startNewTemplate();
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete template.");
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Dialog
        aria-labelledby="message-template-title"
        fullWidth
        maxWidth="sm"
        onClose={saving ? undefined : closeDialog}
        open={open}
      >
        <DialogTitle id="message-template-title">
          {editingId ? "Edit Template" : "Create Template"}
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" id="message-template-form" onSubmit={submit}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              autoFocus
              fullWidth
              label="Template name"
              onChange={(event) => setName(event.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 160 } }}
              value={name}
            />
            <TextField
              fullWidth
              label="Message"
              multiline
              onChange={(event) => {
                setBody(event.target.value);
                bodySelection.current = {
                  start: event.target.selectionStart ?? 0,
                  end: event.target.selectionEnd ?? 0,
                };
              }}
              slotProps={{
                htmlInput: {
                  onBlur: (
                    event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
                  ) => {
                    bodySelection.current = {
                      start: event.currentTarget.selectionStart ?? 0,
                      end: event.currentTarget.selectionEnd ?? 0,
                    };
                  },
                  onSelect: (
                    event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>,
                  ) => {
                    bodySelection.current = {
                      start: event.currentTarget.selectionStart ?? 0,
                      end: event.currentTarget.selectionEnd ?? 0,
                    };
                  },
                },
              }}
              required
              rows={5}
              inputRef={bodyInputRef}
              sx={{ mt: 2 }}
              value={body}
            />
            <Box sx={{ mt: 1.5 }}>
              <Typography color="text.secondary" sx={{ mb: 1 }} variant="body2">
                Click a placeholder to insert it at the cursor:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {(["{{name}}", "{{phone}}", "{{email}}"] as const).map((placeholder) => (
                  <Chip
                    clickable
                    key={placeholder}
                    label={placeholder}
                    onClick={() => insertPlaceholder(placeholder)}
                    onMouseDown={(event) => event.preventDefault()}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          </Box>

          <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", mt: 3 }}>
            <Typography component="h3" sx={{ fontSize: 16, fontWeight: 600 }}>
              Saved templates
            </Typography>
            {editingId && (
              <Button onClick={startNewTemplate} size="small">
                New Template
              </Button>
            )}
          </Box>
          {templates.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }} variant="body2">
              No templates yet.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
              {templates.map((template) => (
                <Box
                  key={template.id}
                  sx={{
                    alignItems: "center",
                    border: "1px solid #e0e0e0",
                    borderRadius: 1,
                    display: "flex",
                    gap: 1,
                    justifyContent: "space-between",
                    p: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="p" noWrap sx={{ fontWeight: 600 }}>
                      {template.name}
                    </Typography>
                    <Typography color="text.secondary" noWrap variant="body2">
                      {template.body}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexShrink: 0, gap: 0.5 }}>
                    <Button onClick={() => startEditing(template)} size="small">
                      Edit
                    </Button>
                    <Button
                      color="error"
                      disabled={deletingId !== null}
                      onClick={() => setDeleteTarget(template)}
                      size="small"
                    >
                      Delete
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={saving} onClick={closeDialog} variant="outlined">
            Close
          </Button>
          <Button
            disabled={!name.trim() || !body.trim() || saving}
            form="message-template-form"
            type="submit"
            variant="contained"
          >
            {saving ? <CircularProgress color="inherit" size={18} /> : editingId ? "Save Changes" : "Save Template"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={() => setDeleteTarget(null)} open={Boolean(deleteTarget)}>
        <DialogTitle>Delete template?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={deletingId !== null} onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button color="error" disabled={deletingId !== null} onClick={() => void confirmDelete()}>
            {deletingId ? <CircularProgress color="inherit" size={18} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
