'use client'

import { OpenwaEnvVarsCard } from './openwa-env-vars-card'
import { OpenwaSenderModuleCard } from './openwa-sender-module-card'
import { OpenwaReminderFlowCard } from './openwa-reminder-flow-card'
import { OpenwaTestCard } from './openwa-test-card'
import { OpenwaAutoSendCard } from './openwa-auto-send-card'
import { OpenwaChannelMatrixCard } from './openwa-channel-matrix-card'

export function OpenwaIntegrationTab() {
  return (
    <div className="space-y-4">
      <OpenwaEnvVarsCard />
      <OpenwaSenderModuleCard />
      <OpenwaReminderFlowCard />
      <OpenwaTestCard />
      <OpenwaAutoSendCard />
      <OpenwaChannelMatrixCard />
    </div>
  )
}
