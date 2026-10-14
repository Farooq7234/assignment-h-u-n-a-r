import { useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Candidate } from "./types";
import {
  bodyCellSx,
  bodyCheckboxSx,
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
  loading: boolean;
  loadFailed: boolean;
  onToggleAllVisible: (candidateIds: string[]) => void;
  onToggleCandidate: (id: string) => void;
  onViewHistory: (candidate: Candidate) => void;
};

export function CandidateTable({
  candidates,
  totalCandidateCount,
  search,
  selectedIds,
  loading,
  loadFailed,
  onToggleAllVisible,
  onToggleCandidate,
  onViewHistory,
}: CandidateTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const filteredCandidateCount = candidates.length;
  const pageCount = Math.max(1, Math.ceil(filteredCandidateCount / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageCandidates = candidates.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage,
  );
  const firstRow = filteredCandidateCount === 0 ? 0 : currentPage * rowsPerPage + 1;
  const lastRow = Math.min((currentPage + 1) * rowsPerPage, filteredCandidateCount);
  const allPageSelected =
    pageCandidates.length > 0 &&
    pageCandidates.every((candidate) => selectedIds.includes(candidate.id));
  const somePageSelected = pageCandidates.some((candidate) =>
    selectedIds.includes(candidate.id),
  );
  const hasCandidates = totalCandidateCount > 0;

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
                  checked={allPageSelected}
                  indeterminate={somePageSelected && !allPageSelected}
                  label="Select all candidates"
                  onChange={() =>
                    onToggleAllVisible(pageCandidates.map((candidate) => candidate.id))
                  }
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
            {pageCandidates.map((candidate) => (
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
              Array.from({ length: Math.max(0, 15 - pageCandidates.length) }).map((_, index) => (
                <TableRow aria-hidden="true" key={`empty-row-${index}`}>
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                  <TableCell sx={emptyBodyCellSx} />
                </TableRow>
              ))}

            {hasCandidates && search.trim() && filteredCandidateCount === 0 && (
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
            flexWrap: "wrap",
            gap: 1.5,
            minHeight: 48,
            px: 1,
          }}
        >
          <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
              <Typography sx={{ color: "rgba(0,0,0,0.87)", fontSize: 14 }}>
                Rows per page:
              </Typography>
              <Select
                aria-label="Rows per page"
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
                size="small"
                value={rowsPerPage}
                variant="standard"
                sx={{
                  color: "rgba(0,0,0,0.87)",
                  fontSize: 14,
                  minWidth: 42,
                  "& .MuiSelect-select": { py: 0.25, pr: 2.5 },
                  "&:before, &:after": { display: "none" },
                }}
              >
                {[10, 25, 50].map((pageSize) => (
                  <MenuItem key={pageSize} value={pageSize}>
                    {pageSize}
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Typography sx={{ color: "rgba(0,0,0,0.87)", fontSize: 14 }}>
              {`${firstRow}-${lastRow} of ${filteredCandidateCount}`}
            </Typography>
            <Typography
              aria-live="polite"
              sx={{ color: "rgba(0,0,0,0.6)", fontSize: 13, whiteSpace: "nowrap" }}
            >
              Page {currentPage + 1} of {pageCount}
            </Typography>
            <Box sx={{ alignItems: "center", display: "flex", gap: 0.5 }}>
              <IconButton
                aria-label="Previous page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                size="small"
                sx={{ height: 32, width: 32 }}
              >
                <Box
                  alt=""
                  component="img"
                  src={candidateAsset("chevron-left")}
                  sx={{ height: 16, width: 16 }}
                />
              </IconButton>
              <IconButton
                aria-label="Next page"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
                size="small"
                sx={{ height: 32, width: 32 }}
              >
                <Box
                  alt=""
                  component="img"
                  src={candidateAsset("chevron-right")}
                  sx={{ height: 16, width: 16 }}
                />
              </IconButton>
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
