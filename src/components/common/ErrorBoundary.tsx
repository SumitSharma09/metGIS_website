import { Component, type ErrorInfo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Top-level error boundary so a rendering bug in one page doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would report to an error-tracking service.
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            p: 3,
            textAlign: 'center',
          }}
        >
          <ReportProblemRoundedIcon color="warning" sx={{ fontSize: 48 }} />
          <Typography variant="h6" fontWeight={700}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            An unexpected error occurred while rendering this page. Try reloading - if the problem
            persists, please contact support.
          </Typography>
          <Button variant="contained" onClick={this.handleReload}>
            Reload the app
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
