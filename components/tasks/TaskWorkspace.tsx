"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  SectionHeader,
} from "@/components/ui";
import { WorkflowHistoryPanel, WorkflowStatusBadge, WorkflowStatusDropdown } from "@/components/workflow";
import { transition } from "@/src/lib/workflows";
import {
  checklistProgress,
  formatHours,
  type Task,
  type TaskChecklistItem,
  type TaskComment,
} from "@/src/modules/tasks/task-types";
import { updateTask as updateTaskClient } from "@/src/modules/tasks/task-client";

type TaskWorkspaceProps = {
  task: Task;
  taskOptions: Task[];
  entityNames: {
    company?: string;
    contact?: string;
    lead?: string;
    quotation?: string;
    contract?: string;
  };
};

function updateChecklistItem(
  items: TaskChecklistItem[],
  itemId: string,
  updater: (item: TaskChecklistItem) => TaskChecklistItem,
): TaskChecklistItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return updater(item);
    }

    if (item.children?.length) {
      return {
        ...item,
        children: updateChecklistItem(item.children, itemId, updater),
      };
    }

    return item;
  });
}

export function TaskWorkspace({ task, taskOptions, entityNames }: TaskWorkspaceProps) {
  const router = useRouter();
  const [localTask, setLocalTask] = React.useState<Task>(task);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalTask(task);
  }, [task]);

  const persist = async (patch: Partial<Task>) => {
    setIsSaving(true);
    setError(null);

    const { error: updateError } = await updateTaskClient(localTask.id, patch);
    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    setLocalTask((current) => ({
      ...current,
      ...patch,
      updated_at: new Date().toISOString(),
    }));
    setIsSaving(false);
  };

  const handleStatusChange = async (nextStatus: string) => {
    if (!nextStatus || nextStatus === localTask.status) {
      return;
    }

    try {
      const result = await transition(
        "tasks",
        localTask.id,
        localTask.status ?? "Open",
        nextStatus,
      );

      await persist({
        status: nextStatus,
        workflow_history: [...(localTask.workflow_history ?? []), result.history],
        workflow_events: [...(localTask.workflow_events ?? []), result.activity],
      });
    } catch (transitionError) {
      setError((transitionError as Error).message);
    }
  };

  const toggleChecklist = async (itemId: string) => {
    const nextChecklist = updateChecklistItem(
      localTask.checklist ?? [],
      itemId,
      (item) => ({ ...item, completed: !item.completed }),
    );

    await persist({ checklist: nextChecklist });
  };

  const addComment = async () => {
    const body = commentDraft.trim();
    if (!body) {
      return;
    }

    const comment: TaskComment = {
      id: `comment-${Date.now()}`,
      author: "You",
      body,
      mentions: Array.from(body.matchAll(/@\w+/g)).map((entry) => entry[0]),
      created_at: new Date().toISOString(),
    };

    const nextComments = [...(localTask.comments ?? []), comment];
    await persist({ comments: nextComments });
    setCommentDraft("");
  };

  const startEditComment = (comment: TaskComment) => {
    setEditingCommentId(comment.id);
    setCommentEditDraft(comment.body);
  };

  const saveCommentEdit = async (comment: TaskComment) => {
    const body = commentEditDraft.trim();
    if (!body) {
      return;
    }

    const nextComments = (localTask.comments ?? []).map((item) =>
      item.id === comment.id
        ? {
            ...item,
            body,
            updated_at: new Date().toISOString(),
          }
        : item,
    );

    await persist({ comments: nextComments });
    setEditingCommentId(null);
    setCommentEditDraft("");
  };

  const deleteComment = async (commentId: string) => {
    const nextComments = (localTask.comments ?? []).filter((item) => item.id !== commentId);
    await persist({ comments: nextComments });
  };

  const completion = checklistProgress(localTask.checklist);
  const tracked = localTask.time_tracking?.tracked ?? localTask.actual_hours ?? 0;
  const estimated = localTask.time_tracking?.estimated ?? localTask.estimated_hours ?? 0;
  const remaining = localTask.time_tracking?.remaining ?? Math.max(estimated - tracked, 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Tasks"
        title={localTask.title}
        description="Manage execution details, collaboration, and status transitions from one task workspace."
        actions={
          <>
            <WorkflowStatusBadge module="tasks" status={localTask.status} archived={localTask.archived} />
            <Button variant="secondary" onClick={() => router.push("/tasks")}>Back to Tasks</Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-foreground">Task Information</h2>
            </CardHeader>
            <CardBody className="space-y-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {localTask.description || "No description has been added yet."}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Checklist</p>
                  <Badge variant="outline">{completion}% complete</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {(localTask.checklist ?? []).length === 0 ? (
                    <p className="rounded-[14px] border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
                      No checklist items yet.
                    </p>
                  ) : (
                    (localTask.checklist ?? []).map((item) => (
                      <div key={item.id} className="rounded-[14px] border border-border bg-surface-muted p-3">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleChecklist(item.id)}
                            className="mt-1 h-4 w-4 rounded border-border text-accent"
                          />
                          <span className="text-sm text-foreground">{item.title}</span>
                        </label>
                        {item.children?.length ? (
                          <div className="mt-2 space-y-2 pl-6">
                            {item.children.map((child) => (
                              <label key={child.id} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={child.completed}
                                  onChange={() => toggleChecklist(child.id)}
                                  className="mt-1 h-4 w-4 rounded border-border text-accent"
                                />
                                <span className="text-sm text-muted-foreground">{child.title}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Files</p>
                <div className="mt-3 space-y-2">
                  {(localTask.attachments ?? []).length === 0 ? (
                    <p className="rounded-[14px] border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
                      No attachments uploaded. Upload and preview architecture is ready.
                    </p>
                  ) : (
                    (localTask.attachments ?? []).map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between rounded-[14px] border border-border bg-surface px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">Version {attachment.version ?? 1}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">Preview</Button>
                          <Button variant="ghost" size="sm">Download</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <WorkflowHistoryPanel
                history={localTask.workflow_history ?? []}
                events={localTask.workflow_events ?? []}
                title="Activity"
              />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Comments</p>
                <div className="mt-3 space-y-3">
                  {(localTask.comments ?? []).map((comment) => (
                    <div key={comment.id} className="rounded-[14px] border border-border bg-surface p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{comment.author}</span>
                        <span>{new Date(comment.updated_at ?? comment.created_at).toLocaleString()}</span>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            className="min-h-20 w-full rounded-[12px] border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
                            value={commentEditDraft}
                            onChange={(event) => setCommentEditDraft(event.target.value)}
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => saveCommentEdit(comment)}>Save</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => startEditComment(comment)}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteComment(comment.id)}>Delete</Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  <div className="rounded-[14px] border border-border bg-surface p-3">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Add a comment. Mentions supported via @name"
                      className="min-h-20 w-full rounded-[12px] border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <div className="mt-2 flex items-center justify-end">
                      <Button size="sm" onClick={addComment} disabled={!commentDraft.trim() || isSaving}>
                        Add Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-foreground">Properties</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <WorkflowStatusDropdown
                module="tasks"
                value={localTask.status}
                currentStatus={localTask.status}
                onChange={handleStatusChange}
              />

              <Input
                label="Priority"
                value={localTask.priority ?? "Medium"}
                onChange={(event) => persist({ priority: event.target.value as Task["priority"] })}
              />

              <Input label="Assignee" value={localTask.assignee ?? ""} onChange={(event) => persist({ assignee: event.target.value })} />
              <Input label="Reporter" value={localTask.reporter ?? ""} onChange={(event) => persist({ reporter: event.target.value })} />
              <Input label="Start Date" type="date" value={localTask.start_date ?? ""} onChange={(event) => persist({ start_date: event.target.value || undefined })} />
              <Input label="Due Date" type="date" value={localTask.due_date ?? ""} onChange={(event) => persist({ due_date: event.target.value || undefined })} />

              <div className="rounded-[14px] border border-border bg-surface-muted p-3 text-sm">
                <p className="font-medium text-foreground">Linked records</p>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  <p>Company: {entityNames.company || "None"}</p>
                  <p>Contact: {entityNames.contact || "None"}</p>
                  <p>Lead: {entityNames.lead || "None"}</p>
                  <p>Quotation: {entityNames.quotation || "None"}</p>
                  <p>Contract: {entityNames.contract || "None"}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-foreground">Time Tracking</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="rounded-[14px] border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
                <p>Estimated: <span className="font-medium text-foreground">{formatHours(estimated)}</span></p>
                <p className="mt-1">Tracked: <span className="font-medium text-foreground">{formatHours(tracked)}</span></p>
                <p className="mt-1">Remaining: <span className="font-medium text-foreground">{formatHours(remaining)}</span></p>
              </div>
              <Button variant="secondary" className="w-full">Start Timer (Placeholder)</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-foreground">Dependencies</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              {(localTask.dependencies ?? []).length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
                  No dependencies configured.
                </p>
              ) : (
                (localTask.dependencies ?? []).map((dependency) => {
                  const dependencyTask = taskOptions.find((item) => item.id === dependency.task_id);
                  return (
                    <div key={`${dependency.task_id}-${dependency.relation}`} className="rounded-[14px] border border-border bg-surface px-3 py-2 text-sm">
                      <p className="font-medium text-foreground">{dependencyTask?.title || dependency.task_id}</p>
                      <p className="text-xs text-muted-foreground">{dependency.relation === "blocks" ? "Blocks this task" : "Depends on this task"}</p>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
