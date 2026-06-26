import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { MetaLabel } from "@/components/bank/deal-room/deal-room-bits";
import {
  assignDealRoomOfficerRecord,
  createDealRoomTaskRecord,
  unassignDealRoomOfficerRecord,
  updateDealRoomTaskRecord,
  updateDealRoomWorkflowRecord,
} from "@/lib/bank/deal-room.functions";
import type { DealRoomOpsContext, DealRoomTimelineEvent } from "@/lib/bank/deal-room-ops-types";
import {
  WORKFLOW_STAGE_LABELS,
  type DealRoomPriorityCode,
  type DealRoomWorkflowStageCode,
} from "@/lib/bank/deal-room-workflow";
import { cn } from "@/lib/utils";

const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const fieldClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]";

export function DealRoomOpsPanel({
  dealRoomId,
  ops,
  officers,
  timeline,
  roomClosed = false,
}: {
  dealRoomId: string;
  ops: DealRoomOpsContext;
  officers: { id: string; name: string }[];
  timeline: DealRoomTimelineEvent[];
  roomClosed?: boolean;
}) {
  const router = useRouter();
  const assignOfficer = useServerFn(assignDealRoomOfficerRecord);
  const unassignOfficer = useServerFn(unassignDealRoomOfficerRecord);
  const updateWorkflow = useServerFn(updateDealRoomWorkflowRecord);
  const createTask = useServerFn(createDealRoomTaskRecord);
  const updateTask = useServerFn(updateDealRoomTaskRecord);

  const [officerId, setOfficerId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [stageOverride, setStageOverride] = useState<DealRoomWorkflowStageCode | "">("");

  async function refresh() {
    await router.invalidate();
  }

  return (
    <section className="space-y-6 border-b border-border bg-surface-1/40 px-4 py-5 sm:px-6">
      <header>
        <h2 className="font-serif text-[17px] tracking-tight">Operations</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Workflow stage, officer ownership, tasks, and SLA tracking.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-2/40 p-4">
          <div className={labelClass}>Current stage</div>
          <p className="mt-1 font-medium">{ops.workflowStageLabel}</p>
          <p className="mt-2 text-[12px] text-muted-foreground">{ops.workflowStageDescription}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <dt className={labelClass}>Time in stage</dt>
              <dd className="mt-0.5 tabular-nums">{ops.hoursInStage}h</dd>
            </div>
            <div>
              <dt className={labelClass}>Team</dt>
              <dd className="mt-0.5">{ops.assignedTeam}</dd>
            </div>
            <div>
              <dt className={labelClass}>Created</dt>
              <dd className="mt-0.5">{ops.createdByName ?? "System"}</dd>
            </div>
            <div>
              <dt className={labelClass}>Priority</dt>
              <dd className="mt-0.5 capitalize">{ops.priority}</dd>
            </div>
          </dl>
          {ops.isStalled ? (
            <p className="mt-3 text-[12px] text-amber-600 dark:text-amber-400">This deal may be stalled.</p>
          ) : null}
          {!roomClosed && (
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                className={cn(fieldClass, "max-w-xs")}
                value={stageOverride}
                onChange={(e) => setStageOverride(e.target.value as DealRoomWorkflowStageCode | "")}
              >
                <option value="">Override stage…</option>
                {Object.entries(WORKFLOW_STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {stageOverride ? (
                <BankReviewButton
                  label="Apply stage"
                  variant="primary"
                  onAction={async () => {
                    await updateWorkflow({
                      data: { dealRoomId, workflowStage: stageOverride as DealRoomWorkflowStageCode },
                    });
                    setStageOverride("");
                    await refresh();
                  }}
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-2/40 p-4">
          <div className={labelClass}>SLA metrics</div>
          <dl className="mt-2 space-y-2 text-[12px]">
            <SlaRow label="First response" hours={ops.sla.timeToFirstResponseHours} />
            <SlaRow label="Time to funding" hours={ops.sla.timeToFundingHours} />
            <SlaRow label="Waiting on applicant" hours={ops.sla.timeWaitingOnApplicantHours} />
            <SlaRow label="Waiting on Alta" hours={ops.sla.timeWaitingOnAltaHours} />
          </dl>
        </div>
      </div>

      {!roomClosed && (
        <div className="rounded-lg border border-border bg-surface-2/40 p-4">
          <div className={labelClass}>Officer assignment</div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1">
              <span className={labelClass}>Assign officer</span>
              <select className={fieldClass} value={officerId} onChange={(e) => setOfficerId(e.target.value)}>
                <option value="">Select officer…</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            {officerId ? (
              <BankReviewButton
                label="Assign"
                variant="primary"
                onAction={async () => {
                  await assignOfficer({ data: { dealRoomId, officerUserId: officerId } });
                  setOfficerId("");
                  await refresh();
                }}
              />
            ) : null}
            <BankReviewButton
              label="Unassign"
              variant="default"
              onAction={async () => {
                await unassignOfficer({ data: dealRoomId });
                await refresh();
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-2/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={labelClass}>Tasks</div>
        </div>
        <ul className="mt-3 space-y-2">
          {ops.tasks.length === 0 ? (
            <li className="text-[13px] text-muted-foreground">No tasks yet.</li>
          ) : (
            ops.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px]"
              >
                <div>
                  <span className="font-medium">{task.title}</span>
                  <span className="ml-2 text-muted-foreground">· {task.statusLabel}</span>
                  {task.isOverdue ? (
                    <span className="ml-2 text-destructive">Overdue</span>
                  ) : null}
                </div>
                {task.status !== "completed" && !roomClosed && (
                  <BankReviewButton
                    label="Complete"
                    variant="default"
                    onAction={async () => {
                      await updateTask({ data: { taskId: task.id, status: "completed" } });
                      await refresh();
                    }}
                  />
                )}
              </li>
            ))
          )}
        </ul>
        {!roomClosed && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={fieldClass}
              placeholder="Task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <select className={fieldClass} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input type="date" className={fieldClass} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            <BankReviewButton
              label="Add task"
              variant="primary"
              onAction={async () => {
                if (!taskTitle.trim()) return;
                await createTask({
                  data: {
                    dealRoomId,
                    title: taskTitle.trim(),
                    assignedToUserId: taskAssignee || null,
                    dueDate: taskDue || null,
                    priority: "medium" as DealRoomPriorityCode,
                  },
                });
                setTaskTitle("");
                setTaskAssignee("");
                setTaskDue("");
                await refresh();
              }}
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-2/40 p-4">
        <div className={labelClass}>Complete timeline</div>
        <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {timeline.slice(0, 40).map((event) => (
            <li key={event.id} className="border-l-2 border-gold/30 pl-3 text-[12px]">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {event.timestampLabel}
              </div>
              <div className="mt-0.5 font-medium">{event.title}</div>
              {event.body ? <p className="text-muted-foreground">{event.body}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SlaRow({ label, hours }: { label: string; hours: number | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="tabular-nums">{hours != null ? `${hours}h` : "—"}</dd>
    </div>
  );
}
