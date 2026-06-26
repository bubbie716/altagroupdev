import type { DealRoomPriorityCode, DealRoomTaskStatusCode, DealRoomWorkflowStageCode } from "@/lib/bank/deal-room-workflow";
import type { DealRoomListRow, DealRoomStatusCode } from "@/lib/bank/deal-room-types";

export type DealRoomOpsListRow = DealRoomListRow & {
  workflowStage: DealRoomWorkflowStageCode;
  workflowStageLabel: string;
  priority: DealRoomPriorityCode;
  assignedTeam: string;
  createdByName: string | null;
  openTaskCount: number;
  hoursInStage: number;
  isStalled: boolean;
  waitingOn: "borrower" | "alta" | null;
};

export type DealRoomOpsDashboard = {
  widgets: {
    needsReview: number;
    waitingOnBorrower: number;
    waitingOnAlta: number;
    readyForFunding: number;
    completedToday: number;
    stalled: number;
    unassigned: number;
  };
  metrics: {
    averageProcessingTimeHours: number;
    averageFundingTimeHours: number;
    averageNegotiationTimeHours: number;
  };
  reporting: {
    applications: number;
    approvals: number;
    declines: number;
    averageLoanSize: number;
    averageFundingTimeHours: number;
    largestLoan: number;
    outstandingDealRooms: number;
  };
  officerWorkload: OfficerWorkloadRow[];
  rooms: DealRoomOpsListRow[];
};

export type OfficerWorkloadRow = {
  officerId: string;
  officerName: string;
  openDealRooms: number;
  pendingTasks: number;
  applicationsThisWeek: number;
  loansFunded: number;
  currentWorkload: number;
};

export type DealRoomSlaMetrics = {
  applicationSubmittedAt: string;
  officerFirstResponseAt: string | null;
  documentsRequestedAt: string | null;
  documentsReceivedAt: string | null;
  agreementGeneratedAt: string | null;
  borrowerSignedAt: string | null;
  bankSignedAt: string | null;
  fundingCompletedAt: string | null;
  timeToFirstResponseHours: number | null;
  timeToFundingHours: number | null;
  timeWaitingOnApplicantHours: number | null;
  timeWaitingOnAltaHours: number | null;
};

export type DealRoomTaskRow = {
  id: string;
  dealRoomId: string;
  title: string;
  description: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  priority: DealRoomPriorityCode;
  priorityLabel: string;
  dueDate: string | null;
  status: DealRoomTaskStatusCode;
  statusLabel: string;
  createdByName: string;
  completedAt: string | null;
  createdAt: string;
  isOverdue: boolean;
};

export type DealRoomOpsContext = {
  dealRoomId: string;
  workflowStage: DealRoomWorkflowStageCode;
  workflowStageLabel: string;
  workflowStageDescription: string;
  stageEnteredAt: string;
  hoursInStage: number;
  assignedTeam: string;
  createdByName: string | null;
  createdAt: string;
  priority: DealRoomPriorityCode;
  isStalled: boolean;
  sla: DealRoomSlaMetrics;
  tasks: DealRoomTaskRow[];
  stageHistory: {
    stage: DealRoomWorkflowStageCode;
    stageLabel: string;
    ownerName: string | null;
    enteredAt: string;
    exitedAt: string | null;
    timeInStageHours: number;
  }[];
};

export type DealRoomTimelineEvent = {
  id: string;
  kind: "message" | "system" | "offer" | "document" | "document_request" | "stage" | "task" | "agreement";
  title: string;
  body: string | null;
  timestamp: string;
  timestampLabel: string;
};

export type DealRoomOpsSearchInput = {
  query?: string;
  stage?: DealRoomWorkflowStageCode | "all";
  priority?: DealRoomPriorityCode | "all";
  officerId?: string | "all" | "unassigned";
  status?: DealRoomStatusCode | "all";
  product?: string | "all";
  fundingStatus?: "all" | "open" | "funded";
  stalledOnly?: boolean;
};

export type CreateDealRoomTaskInput = {
  dealRoomId: string;
  title: string;
  description?: string;
  assignedToUserId?: string | null;
  priority?: DealRoomPriorityCode;
  dueDate?: string | null;
};

export type UpdateDealRoomTaskInput = {
  taskId: string;
  title?: string;
  description?: string;
  assignedToUserId?: string | null;
  priority?: DealRoomPriorityCode;
  dueDate?: string | null;
  status?: DealRoomTaskStatusCode;
};

export type UpdateDealRoomWorkflowInput = {
  dealRoomId: string;
  workflowStage?: DealRoomWorkflowStageCode;
  priority?: DealRoomPriorityCode;
  assignedTeamLabel?: string;
};
