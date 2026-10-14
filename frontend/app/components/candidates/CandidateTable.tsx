import { Box, Button, CircularProgress, Link, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import type { Candidate } from "./types";
import {
  bodyCellSx,
  bodyCheckboxSx,
  CandidateIcon,
  CandidateSelectionCheckbox,
  CandidateStatusChip,
  CandidateTableHeaderCell,
  emptyBodyCellSx,
  headerCheckboxSx,
} from "./CandidateControls";
import { candidateAsset } from "./assets";

type CandidateTableProps = {
  candidates: Candidate[];
  totalCandidateCount: number;
  search: string;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  loading: boolean;
  loadFailed: boolean;
  onToggleAllVisible: () => void;
  onToggleCandidate: (id: string) => void;
  onViewHistory: (candidate: Candidate) => void;
};

export function CandidateTable({
  candidates,
  totalCandidateCount,
  search,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  loading,
  loadFailed,
  onToggleAllVisible,
  onToggleCandidate,
  onViewHistory,
}: CandidateTableProps) {
  const visibleCandidateCount = candidates.length;
  const hasCandidates = totalCandidateCount > 0;
  const emptyRange = visibleCandidateCount === 0;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "4px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 88px)",
        mb: 1,
        ml: 0,
        mr: 1,
        minHeight: 480,
        p: 1,
        mt: 1,
      }}
    >
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
        <Table
          aria-label="Candidates"
          sx={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            minWidth: 1080,
            width: "100%",
            "& .MuiTableCell-root": { boxSizing: "border-box" },
          }}
        >
          <colgroup>
            <col style={{ width: 48 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: "calc((100% - 288px) / 4)" }} />
            <col style={{ width: "calc((100% - 288px) / 4)" }} />
            <col style={{ width: "calc((100% - 288px) / 4)" }} />
            <col style={{ width: "calc((100% - 288px) / 4)" }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={headerCheckboxSx}>
                <CandidateSelectionCheckbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  label="Select all candidates"
                  onChange={onToggleAllVisible}
                />
              </TableCell>
              <CandidateTableHeaderCell label="Full name" />
              <CandidateTableHeaderCell label="Mobile number" />
              <CandidateTableHeaderCell label="Last message" />
              <CandidateTableHeaderCell label="Status" />
              <CandidateTableHeaderCell label="Candidate ID" />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} sx={{ ...bodyCellSx, height: 120, textAlign: "center" }}>
                  <CircularProgress aria-label="Loading candidates" size={24} />
                </TableCell>
              </TableRow>
            )}
            {!loading && loadFailed && candidates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ ...bodyCellSx, height: 84, textAlign: "center" }}>
                  Candidates could not be loaded. The page will retry automatically.
                </TableCell>
              </TableRow>
            )}
            {candidates.map((candidate) => (
              <TableRow key={candidate.id}>
                <TableCell align="center" sx={bodyCheckboxSx}>
                  <CandidateSelectionCheckbox
                    checked={selectedIds.includes(candidate.id)}
                    label={`Select ${candidate.name}`}
                    onChange={() => onToggleCandidate(candidate.id)}
                  />
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, px: 1 }}>
                  <Link
                    aria-label={`View communication history for ${candidate.name}`}
                    component="a"
                    href="#communication-history"
                    onClick={(event) => {
                      event.preventDefault();
                      onViewHistory(candidate);
                    }}
                    underline="none"
                    sx={{
                      color: "#4081dd",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {candidate.name}
                  </Link>
                </TableCell>
                <TableCell sx={bodyCellSx}>{candidate.mobile}</TableCell>
                <TableCell
                  sx={{
                    ...bodyCellSx,
                    color: candidate.lastMessage ? "#212121" : "#9d9d9d",
                  }}
                >
                  {candidate.lastMessage ?? "NA"}
                </TableCell>
                <TableCell sx={bodyCellSx}>
                  <CandidateStatusChip status={candidate.status} />
                </TableCell>
                <TableCell sx={bodyCellSx}>{candidate.candidateId}</TableCell>
              </TableRow>
            ))}

            {hasCandidates && !search.trim() &&
              Array.from({ length: Math.max(0, 15 - visibleCandidateCount) }).map((_, index) => (
                <TableRow aria-hidden="true" key={`empty-row-${index}`}>
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                </TableRow>
              ))}

            {hasCandidates && search.trim() && visibleCandidateCount === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ ...bodyCellSx, height: 84, textAlign: "center" }}>
                  No matching candidates
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {!loading && !loadFailed && !hasCandidates && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: 1,
              left: "50%",
              position: "absolute",
              top: 164,
              transform: "translateX(-50%)",
              width: "min(386px, calc(100% - 32px))",
            }}
          >
            <Box
              sx={{
                alignItems: "center",
                display: "flex",
                height: 220,
                justifyContent: "center",
                width: 220,
              }}
            >
              <Box
                alt=""
                component="img"
                src={candidateAsset("empty-interview")}
                sx={{ display: "block" }}
              />
            </Box>
            <Typography
              component="p"
              sx={{ color: "#212121", fontSize: 18, fontWeight: 700, lineHeight: "24px" }}
            >
              No candidates added
            </Typography>
            <Typography
              component="p"
              sx={{ color: "#212121", fontSize: 16, lineHeight: "18px", textAlign: "center" }}
            >
              When you add a candidate, they will appear here.
            </Typography>
          </Box>
        )}
      </TableContainer>

      {hasCandidates && (
        <Box
          component="footer"
          sx={{
            alignItems: "center",
            display: "flex",
            flexShrink: 0,
            height: 48,
            justifyContent: "space-between",
            px: 1,
          }}
        >
          <Box sx={{ alignItems: "center", display: "flex", gap: 3 }}>
            <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
              <Typography sx={{ color: "rgba(0,0,0,0.87)", fontSize: 14 }}>
                Rows per page:
              </Typography>
              <Button
                endIcon={<CandidateIcon name="arrow-dropdown" />}
                sx={{ color: "rgba(0,0,0,0.87)", minWidth: 0, p: 0, fontSize: 14 }}
              >
                10
              </Button>
            </Box>
            <Typography sx={{ color: "rgba(0,0,0,0.87)", fontSize: 14 }}>
              {emptyRange ? "0-0 of 0" : `1-${visibleCandidateCount} of ${totalCandidateCount}`}
            </Typography>
          </Box>
          <Box sx={{ alignItems: "center", display: "flex", gap: 2 }}>
            <CandidateIcon name="pagination" />
            <CandidateIcon name="chevron-left" />
            <CandidateIcon name="chevron-right" />
            <Box sx={{ transform: "rotate(180deg)" }}>
              <CandidateIcon name="pagination" />
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
