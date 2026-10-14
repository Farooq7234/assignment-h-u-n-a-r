import { Box, Button, CircularProgress, Dialog, Typography } from "@mui/material";
import type { Candidate } from "./types";
import { candidateAsset } from "./assets";

type DeleteCandidateDialogProps = {
  candidates: Candidate[];
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  deleting?: boolean;
};

export function DeleteCandidateDialog({
  candidates,
  open,
  onClose,
  onConfirm,
  deleting = false,
}: DeleteCandidateDialogProps) {
  const candidateNames = candidates.map((candidate) => candidate.name);
  const isSingleCandidate = candidateNames.length === 1;
  const names =
    candidateNames.length === 2
      ? candidateNames.join(" and ")
      : candidateNames.length > 2
        ? `${candidateNames.slice(0, -1).join(", ")}, and ${candidateNames.at(-1)}`
        : candidateNames[0] ?? "";

  return (
    <Dialog
      aria-labelledby="delete-candidate-title"
      maxWidth={false}
      onClose={onClose}
      open={open}
      sx={{
        "& .MuiBackdrop-root": { backgroundColor: "rgba(0, 0, 0, 0.05)" },
        "& .MuiDialog-container": { p: 2 },
        "& .MuiDialog-paper": {
          border: "1px solid #bdbdbd",
          borderRadius: 0,
          boxShadow: "-2px 0 12px rgba(0, 0, 0, 0.16)",
          boxSizing: "border-box",
          height: 360,
          maxHeight: "calc(100% - 32px)",
          maxWidth: "calc(100% - 32px)",
          m: 0,
          overflow: "hidden",
          width: 600,
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ px: 5, pt: 5 }}>
          <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <Typography
              component="h2"
              id="delete-candidate-title"
              sx={{ color: "#000", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
            >
              Delete Candidate
            </Typography>
            <Button
              aria-label="Close"
              onClick={onClose}
              sx={{ height: 24, minWidth: 24, p: 0, width: 24 }}
            >
              <Box alt="" component="img" src={candidateAsset("close")} sx={{ height: 24, width: 24 }} />
            </Button>
          </Box>

          <Box sx={{ mt: 6 }}>
            <Typography sx={{ color: "#212121", fontSize: 16, lineHeight: 1.35 }}>
              Are you sure you want to delete {isSingleCandidate ? "this Candidate" : "these Candidates"}?
            </Typography>
            <Typography
              sx={{
                color: "rgba(0, 0, 0, 0.6)",
                fontFamily: "Roboto, Arial, sans-serif",
                fontSize: 12,
                letterSpacing: "0.4px",
                lineHeight: 1.66,
                mt: 0.5,
              }}
            >
              This action cannot be undone, and you’ll lose all communication history with {names}.
            </Typography>
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
          <Button disabled={deleting} onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button color="error" disabled={deleting} onClick={onConfirm} variant="contained">
            {deleting ? <CircularProgress color="inherit" size={18} /> : "Delete Candidate"}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
