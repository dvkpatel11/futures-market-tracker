import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Slider,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Bell, BellOff } from "lucide-react";
import React, { useState } from "react";
import { AlertConfig, MarketConfig } from "../utils/types";

interface TelegramAlertSetupProps {
  marketConfig: MarketConfig;
  onAlertConfigurationSave: (config: {
    telegramToken: string;
    chatId: string;
    enableAlerts: boolean;
    customAlertConfig?: Partial<AlertConfig>;
  }) => void;
}

const TelegramAlertSetup: React.FC<TelegramAlertSetupProps> = ({ marketConfig, onAlertConfigurationSave }) => {
  const [open, setOpen] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enableAlerts, setEnableAlerts] = useState(false);

  // Custom alert configuration state
  const [customAlertConfig, setCustomAlertConfig] = useState<Partial<AlertConfig>>({
    minOverallStrength: marketConfig.alerting.minOverallStrength,
    requiredTimeframes: marketConfig.alerting.requiredTimeframes,
    alertCooldown: marketConfig.alerting.alertCooldown,
    priceChangeThreshold: marketConfig.alerting.priceChangeThreshold,
  });

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleSave = () => {
    onAlertConfigurationSave({
      telegramToken,
      chatId,
      enableAlerts,
      customAlertConfig,
    });
    handleClose();
  };

  return (
    <>
      <Tooltip title={enableAlerts ? "Alerts Enabled" : "Configure Alerts"}>
        <IconButton color="inherit" onClick={handleOpen}>
          {enableAlerts ? <Bell /> : <BellOff />}
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Telegram Notification Setup</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Telegram Bot Token"
              type="text"
              fullWidth
              variant="outlined"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              helperText="Create a bot via BotFather on Telegram"
            />
            <TextField
              margin="dense"
              label="Telegram Chat ID"
              type="text"
              fullWidth
              variant="outlined"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              helperText="Your personal or group chat ID"
            />

            <Typography variant="h6" sx={{ mt: 2 }}>
              Alert Configuration
            </Typography>

            <Box>
              <Typography gutterBottom>Minimum Overall Strength: {customAlertConfig.minOverallStrength}</Typography>
              <Slider
                value={customAlertConfig.minOverallStrength}
                onChange={(_, value) =>
                  setCustomAlertConfig((prev) => ({
                    ...prev,
                    minOverallStrength: value as number,
                  }))
                }
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Box>

            <Box>
              <Typography gutterBottom>Alert Cooldown (ms): {customAlertConfig.alertCooldown}</Typography>
              <Slider
                value={customAlertConfig.alertCooldown}
                onChange={(_, value) =>
                  setCustomAlertConfig((prev) => ({
                    ...prev,
                    alertCooldown: value as number,
                  }))
                }
                min={5000}
                max={300000}
                step={1000}
                valueLabelDisplay="auto"
              />
            </Box>

            <Box>
              <Typography gutterBottom>Price Change Threshold (%): {customAlertConfig.priceChangeThreshold}</Typography>
              <Slider
                value={customAlertConfig.priceChangeThreshold}
                onChange={(_, value) =>
                  setCustomAlertConfig((prev) => ({
                    ...prev,
                    priceChangeThreshold: value as number,
                  }))
                }
                min={0.1}
                max={10}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Box>

            <FormControlLabel
              control={<Checkbox checked={enableAlerts} onChange={() => setEnableAlerts(!enableAlerts)} />}
              label="Enable Telegram Alerts"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TelegramAlertSetup;
