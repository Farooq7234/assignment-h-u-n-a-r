import { Box, Checkbox, TableCell, Typography } from "@mui/material";
import type { Candidate } from "./types";
import { candidateAsset } from "./assets";

export function CandidateStatusChip({ status }: { status: Candidate["status"] }) {
  if (!status) {
    return (
      <Typography component="span" sx={{ color: "#9d9d9d", fontSize: 14 }}>
        NA
      </Typography>
    );
  }

  const statusStyles = {
    Scheduled: { background: "#fff3e0", color: "#e65100", icon: null },
    Read: { background: "#e8f5e9", color: "#2e7d32", icon: null },
    Delivered: { background: "#e8f5e9", color: "#2e7d32", icon: null },
    Failed: { background: "#feebee", color: "#c62828", icon: "error" },
    Sent: { background: "#e3f2fd", color: "#1565c0", icon: null },
  } as const;
  const style = statusStyles[status];

  return (
    <Box
      component="span"
      sx={{
        alignItems: "center",
        backgroundColor: style.background,
        borderRadius: "100px",
        color: style.color,
        display: "inline-flex",
        fontSize: 13,
        gap: 0.5,
        letterSpacing: "0.16px",
        lineHeight: "18px",
        minHeight: 24,
        px: 0.75,
        py: 0.25,
      }}
    >
      {style.icon && (
        <Box alt="" component="img" src={candidateAsset(style.icon)} sx={{ height: 16, width: 16 }} />
      )}
      <Box component="span" sx={{ px: style.icon ? 0.25 : 0.75 }}>
        {status}
      </Box>
    </Box>
  );
}

export function CandidateSelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <Checkbox
      checkedIcon={
        <Box
          sx={{
            backgroundColor: "#2196f3",
            border: "2px solid #2196f3",
            borderRadius: "2px",
            height: 16,
            position: "relative",
            width: 16,
            "&::after": indeterminate
              ? {
                  backgroundColor: "white",
                  content: '""',
                  height: 2,
                  left: 2,
                  position: "absolute",
                  top: 5,
                  width: 8,
                }
              : {
                  borderBottom: "2px solid white",
                  borderRight: "2px solid white",
                  content: '""',
                  height: 8,
                  left: 4,
                  position: "absolute",
                  top: 1,
                  transform: "rotate(45deg)",
                  width: 4,
                },
          }}
        />
      }
      checked={checked || indeterminate}
      icon={
        <Box
          component="img"
          src={candidateAsset("checkbox")}
          sx={{ display: "block", height: 20, width: 20 }}
        />
      }
      onChange={onChange}
      slotProps={{ input: { "aria-label": label } }}
      sx={{ p: 0 }}
    />
  );
}

export function CandidateTableHeaderCell({ label }: { label: string }) {
  return (
    <TableCell sx={headerCellSx}>
      <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography component="span" sx={{ color: "#212121", fontSize: 14, fontWeight: 700 }}>
          {label}
        </Typography>
        <Box
          alt=""
          component="img"
          src={candidateAsset("filter")}
          sx={{ flexShrink: 0, height: 16, width: 16 }}
        />
      </Box>
    </TableCell>
  );
}

export function CandidateIcon({ name }: { name: string }) {
  return <Box alt="" component="img" src={candidateAsset(name)} sx={{ height: 24, width: 24 }} />;
}

export const headerCheckboxSx = {
  backgroundColor: "#f6f6f6",
  borderBottom: "1px solid #ccc",
  height: 48,
  p: 0,
};

export const bodyCheckboxSx = {
  borderBottom: "1px solid #eee",
  height: 42,
  p: 0,
};

export const bodyCellSx = {
  borderBottom: "1px solid #eee",
  color: "#212121",
  fontSize: 14,
  height: 42,
  px: 1.5,
  py: 1,
  whiteSpace: "nowrap",
};

export const emptyBodyCellSx = {
  borderBottom: "1px solid #eee",
  height: 42,
  p: 0,
};

const headerCellSx = {
  backgroundColor: "#f6f6f6",
  borderBottom: "1px solid #ccc",
  color: "#212121",
  fontSize: 14,
  fontWeight: 700,
  height: 48,
  px: 1.5,
  py: 1,
  whiteSpace: "nowrap",
};
