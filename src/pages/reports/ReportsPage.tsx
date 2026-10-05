import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { PageHeader } from '@/components/common/PageHeader';
import { TowerRiskReportsTab } from './TowerRiskReportsTab';
import { SavedReportsTab } from './SavedReportsTab';
import { DailyNationalBulletin } from './components/DailyNationalBulletin';
import { DailyCircleBulletin } from './components/DailyCircleBulletin';

// 'risk' (renamed on-screen to "Districts Risk Reports" - still the same
// tab/component/data underneath, see TowerRiskReportsTab.tsx) is unchanged -
// the SOW document's own "Daily National Bulletin (Planned)" / "Daily
// Circle level bulletin (Planned)" samples are added as two more choices
// here, rather than folded into the existing tab, so the user can pick
// whichever report format they want instead of always seeing all three at
// once.
type ReportsTab = 'risk' | 'nationalBulletin' | 'circleBulletin' | 'saved';

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportsTab>('risk');

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Districts Risk Reports"
        description="Current and forecast weather risk across every district's tower network, with Excel/PDF export"
      />

      <Tabs value={tab} onChange={(_e, v: ReportsTab) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab value="risk" label="Districts Risk Reports" />
        <Tab value="nationalBulletin" label="Daily Bulletin - National" />
        <Tab value="circleBulletin" label="Daily Bulletin - Circle Wise" />
        <Tab value="saved" label="Saved Reports" />
      </Tabs>

      {tab === 'risk' && <TowerRiskReportsTab />}
      {tab === 'nationalBulletin' && <DailyNationalBulletin />}
      {tab === 'circleBulletin' && <DailyCircleBulletin />}
      {tab === 'saved' && <SavedReportsTab />}
    </Stack>
  );
}
