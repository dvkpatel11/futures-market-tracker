import { Box, CircularProgress } from "@mui/material";
import React from "react";

const LoadingSpinner = () => (
  <Box display="flex" justifyContent="center" alignItems="center" style={{ height: "100%", width: "100%" }}>
    <CircularProgress />
  </Box>
);

export default LoadingSpinner;
