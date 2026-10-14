import { Box, Button, InputAdornment, TextField, Typography } from "@mui/material";
import { candidateAsset } from "./assets";

type CandidateToolbarProps = {
  search: string;
  selectedCount: number;
  onSearchChange: (value: string) => void;
  onAddCandidate: () => void;
  onDeleteCandidates: () => void;
  onSendMessage: () => void;
  onManageTemplates: () => void;
};

export function CandidateToolbar({
  search,
  selectedCount,
  onSearchChange,
  onAddCandidate,
  onDeleteCandidates,
  onSendMessage,
  onManageTemplates,
}: CandidateToolbarProps) {
  return (
    <Box
      component="header"
      sx={{
        alignItems: "center",
        backgroundColor: "#fff",
        boxSizing: "border-box",
        display: "flex",
        gap: 2,
        height: 72,
        justifyContent: "space-between",
        px: 3,
        py: 1,
        "@media (max-width: 1150px)": {
          alignItems: "flex-start",
          flexDirection: "column",
          height: "auto",
          py: 2,
        },
      }}
    >
      <Typography
        component="h1"
        sx={{ color: "#000", flexShrink: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}
      >
        Candidate communication
      </Typography>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          gap: 1,
          justifyContent: "flex-end",
          minWidth: 0,
          "@media (max-width: 1150px)": {
            flexWrap: "wrap",
            justifyContent: "flex-start",
            width: "100%",
          },
        }}
      >
        <Button
          onClick={onAddCandidate}
          startIcon={
            <Box alt="" component="img" src={candidateAsset("add")} sx={{ height: 20, width: 20 }} />
          }
          variant="outlined"
        >
          Add Candidate
        </Button>
        <Button
          onClick={onManageTemplates}
          variant="outlined"
        >
          Create Template
        </Button>
        <Button
          disabled={selectedCount === 0}
          onClick={onDeleteCandidates}
          startIcon={
            <Box
              alt=""
              component="img"
              src={candidateAsset("delete")}
              sx={{ height: 20, width: 20 }}
            />
          }
          variant="contained"
        >
          Delete Candidate
        </Button>
        <Button
          disabled={selectedCount === 0}
          onClick={onSendMessage}
          startIcon={
            <Box
              alt=""
              component="img"
              src={candidateAsset("send")}
              sx={{ height: 20, width: 20 }}
            />
          }
          variant="contained"
        >
          Send Message
        </Button>
        <TextField
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search"
          size="small"
          value={search}
          variant="outlined"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    alt=""
                    component="img"
                    src={candidateAsset("search")}
                    sx={{ height: 16, width: 16 }}
                  />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: 240,
            "& .MuiOutlinedInput-root": { borderRadius: "4px", height: 40, fontSize: 14 },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#ccc" },
            "& .MuiInputBase-input": { py: 1 },
          }}
        />
      </Box>
    </Box>
  );
}
