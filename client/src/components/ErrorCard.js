import { Card, CardContent, Typography } from "@mui/material";
import React from "react";

// Component
const ErrorCard = ({ message, severity = "error" }) => {
  const colors = {
    error: { background: "#f8d7da", text: "#721c24" },
    warning: { background: "#fff3cd", text: "#856404" },
    info: { background: "#d1ecf1", text: "#0c5460" },
    success: { background: "#d4edda", text: "#155724" },
  };

  const { background, text } = colors[severity] || colors.error;

  return (
    <Card
      style={{
        backgroundColor: background,
        color: text,
        margin: "1rem",
      }}
      aria-live="assertive"
      role="alert"
    >
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {severity.charAt(0).toUpperCase() + severity.slice(1)}
        </Typography>
        <Typography variant="body1">{message}</Typography>
      </CardContent>
    </Card>
  );
};

export default ErrorCard;
