import { describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../src/config/prisma.ts";
import { getThisWeekRange } from "../../src/shared/utils/date-range.ts";
import {
  addActiveMember,
  addActiveProjectMember,
  app,
  createProject,
  createTask,
  createWorkspace,
  signUp,
} from "../helpers/api.ts";

async function setupOwnerProject(overrides: Partial<{ timezone: string }> = {}) {
  const owner = await signUp({ timezone: overrides.timezone });
  const workspace = await createWorkspace(owner.accessToken);
  const project = await createProject(owner.accessToken, workspace.slug);
  return { owner, workspace, project };
}

describe("POST /workspaces/:workspaceSlug/projects/:projectSlug/tasks", () => {
  it("lets any project member (not just a manager) create tasks, numbered sequentially", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const first = await createTask(memberUser.accessToken, workspace.slug, project.slug, { title: "First task" });
    const second = await createTask(memberUser.accessToken, workspace.slug, project.slug, { title: "Second task" });

    expect(first.taskNumber).toBe(1);
    expect(second.taskNumber).toBe(2);
  });

  it("404s when assigning the task to someone who is not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const outsider = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ title: "Task", priority: "MEDIUM", assigneeId: outsider.user.id });

    expect(res.status).toBe(404);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks", () => {
  it("excludes archived tasks by default", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.body.data).toHaveLength(0);
  });

  it("filters by status, priority and assigneeId", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Low", priority: "LOW" });
    const urgent = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Urgent",
      priority: "URGENT",
      assigneeId: owner.user.id,
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .query({ priority: "URGENT", assigneeId: owner.user.id })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(urgent.id);
  });

  it("filters by assigneeId=UNASSIGNED", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const unassigned = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Unassigned" });
    await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Assigned",
      assigneeId: owner.user.id,
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .query({ assigneeId: "UNASSIGNED" })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(unassigned.id);
  });

  it("filters by isFavorite", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const favorited = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Favorited" });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Not favorited" });
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${favorited.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .query({ isFavorite: "true" })
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(favorited.id);
    expect(res.body.data[0].isFavorite).toBe(true);
  });

  it("filters by dueDate=OVERDUE, THIS_WEEK and NONE", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const now = new Date();
    const overdue = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Overdue",
      dueDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    });
    const dueToday = await createTask(owner.accessToken, workspace.slug, project.slug, {
      title: "Due today",
      dueDate: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    });
    const noDueDate = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "No due date" });

    const overdueRes = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .query({ dueDate: "OVERDUE" })
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(overdueRes.body.data.map((task: { id: string }) => task.id)).toEqual([overdue.id]);

    const thisWeekRes = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .query({ dueDate: "THIS_WEEK" })
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(thisWeekRes.body.data.map((task: { id: string }) => task.id)).toContain(dueToday.id);

    const noneRes = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks`)
      .query({ dueDate: "NONE" })
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(noneRes.body.data.map((task: { id: string }) => task.id)).toEqual([noDueDate.id]);
  });

  it("resolves dueDate=THIS_WEEK against the requesting user's own timezone, not the server's", async () => {
    // 6h antes del inicio (UTC) de la semana actual: cae fuera de la semana en UTC, pero un
    // usuario en Etc/GMT+12 (12h detras) todavia lo ve dentro de su propia semana, ya sea porque
    // su lunes local empieza 12h mas tarde en UTC (misma semana) o porque para el todavia no ha
    // empezado la semana nueva (semana anterior completa). En los dos casos el limite queda dentro.
    const utcWeek = getThisWeekRange(new Date(), "UTC");
    const dueDate = new Date(utcWeek.start.getTime() - 6 * 60 * 60 * 1000).toISOString();

    const utcOwner = await setupOwnerProject({ timezone: "UTC" });
    const utcTask = await createTask(utcOwner.owner.accessToken, utcOwner.workspace.slug, utcOwner.project.slug, {
      dueDate,
    });

    const behindOwner = await setupOwnerProject({ timezone: "Etc/GMT+12" });
    const behindTask = await createTask(
      behindOwner.owner.accessToken,
      behindOwner.workspace.slug,
      behindOwner.project.slug,
      { dueDate },
    );

    const utcRes = await request(app)
      .get(`/api/workspaces/${utcOwner.workspace.slug}/projects/${utcOwner.project.slug}/tasks`)
      .query({ dueDate: "THIS_WEEK" })
      .set("Cookie", `accessToken=${utcOwner.owner.accessToken}`);
    expect(utcRes.body.data.map((task: { id: string }) => task.id)).not.toContain(utcTask.id);

    const behindRes = await request(app)
      .get(`/api/workspaces/${behindOwner.workspace.slug}/projects/${behindOwner.project.slug}/tasks`)
      .query({ dueDate: "THIS_WEEK" })
      .set("Cookie", `accessToken=${behindOwner.owner.accessToken}`);
    expect(behindRes.body.data.map((task: { id: string }) => task.id)).toContain(behindTask.id);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks/board", () => {
  it("returns every live task at once, without pagination", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    for (let index = 0; index < 12; index += 1) {
      await createTask(owner.accessToken, workspace.slug, project.slug, { title: `Task ${index + 1}` });
    }
    const archived = await createTask(owner.accessToken, workspace.slug, project.slug, { title: "Archived" });
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${archived.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/board`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    // Array plano, no PaginatedResponseDto: el limite por pagina del listado es 10 por defecto.
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
    expect(res.body.every((task: { rank: string }) => typeof task.rank === "string")).toBe(true);
  });

  it("403s when the user is not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/board`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber", () => {
  it("403s when the user is a workspace member but not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const outsider = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: outsider.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("404s when the task number does not exist", async () => {
    const { owner, workspace, project } = await setupOwnerProject();

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/999`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("403s when the user's project membership was deactivated", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/members/${memberUser.user.id}/deactivate`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber", () => {
  it("lets any project member (not just a manager) update a task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated title");
  });

  it("sets completedAt when moved to DONE and clears it when moved away from DONE", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const done = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "DONE" });
    expect(done.body.completedAt).not.toBeNull();

    const reopened = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ status: "IN_PROGRESS" });
    expect(reopened.body.completedAt).toBeNull();
  });

  it("400s when the task is archived", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ title: "Should not work" });

    expect(res.status).toBe(400);
  });

  it("404s when reassigning to someone who is not a project member", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const outsider = await signUp();

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ assigneeId: outsider.user.id });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/move", () => {
  async function setupColumn(count: number) {
    const { owner, workspace, project } = await setupOwnerProject();

    const tasks = [];
    for (let index = 0; index < count; index += 1) {
      tasks.push(await createTask(owner.accessToken, workspace.slug, project.slug, { title: `Task ${index + 1}` }));
    }

    return { owner, workspace, project, tasks };
  }

  function move({
    accessToken,
    workspaceSlug,
    projectSlug,
    taskNumber,
    status,
    afterTaskId,
  }: {
    accessToken: string;
    workspaceSlug: string;
    projectSlug: string;
    taskNumber: number;
    status: string;
    afterTaskId: string | null;
  }) {
    return request(app)
      .patch(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/tasks/${taskNumber}/move`)
      .set("Cookie", `accessToken=${accessToken}`)
      .send({ status, afterTaskId });
  }

  async function columnOrder({
    accessToken,
    workspaceSlug,
    projectSlug,
    status,
  }: {
    accessToken: string;
    workspaceSlug: string;
    projectSlug: string;
    status: string;
  }) {
    // Se lee del tablero y no del listado paginado: aquel devuelve la columna entera, sin tope de
    // pagina, que es justo como la consume el kanban.
    const res = await request(app)
      .get(`/api/workspaces/${workspaceSlug}/projects/${projectSlug}/tasks/board`)
      .set("Cookie", `accessToken=${accessToken}`);

    return (res.body as { id: string; status: string }[])
      .filter((task) => task.status === status)
      .map((task) => task.id);
  }

  it("reorders within a column, placing the task at the top when there is no anchor", async () => {
    const { owner, workspace, project, tasks } = await setupColumn(3);
    const [first, second, third] = tasks;

    const res = await move({
      accessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      taskNumber: third.taskNumber,
      status: "TODO",
      afterTaskId: null,
    });

    expect(res.status).toBe(200);
    await expect(
      columnOrder({
        accessToken: owner.accessToken,
        workspaceSlug: workspace.slug,
        projectSlug: project.slug,
        status: "TODO",
      }),
    ).resolves.toEqual([third.id, first.id, second.id]);
  });

  it("moves a task into another column right after the anchor", async () => {
    const { owner, workspace, project, tasks } = await setupColumn(3);
    const [first, second, third] = tasks;
    const context = { accessToken: owner.accessToken, workspaceSlug: workspace.slug, projectSlug: project.slug };

    await move({ ...context, taskNumber: first.taskNumber, status: "IN_PROGRESS", afterTaskId: null });
    await move({ ...context, taskNumber: second.taskNumber, status: "IN_PROGRESS", afterTaskId: first.id });
    // Se cuela entre las dos que ya estaban en la columna destino.
    await move({ ...context, taskNumber: third.taskNumber, status: "IN_PROGRESS", afterTaskId: first.id });

    await expect(columnOrder({ ...context, status: "IN_PROGRESS" })).resolves.toEqual([
      first.id,
      third.id,
      second.id,
    ]);
    await expect(columnOrder({ ...context, status: "TODO" })).resolves.toEqual([]);
  });

  it("400s when the anchor belongs to a different column than the destination", async () => {
    const { owner, workspace, project, tasks } = await setupColumn(2);
    const [first, second] = tasks;
    const context = { accessToken: owner.accessToken, workspaceSlug: workspace.slug, projectSlug: project.slug };

    const res = await move({ ...context, taskNumber: second.taskNumber, status: "DONE", afterTaskId: first.id });

    expect(res.status).toBe(400);
  });

  it("400s when a task is anchored to itself", async () => {
    const { owner, workspace, project, tasks } = await setupColumn(1);
    const [only] = tasks;
    const context = { accessToken: owner.accessToken, workspaceSlug: workspace.slug, projectSlug: project.slug };

    const res = await move({ ...context, taskNumber: only.taskNumber, status: "TODO", afterTaskId: only.id });

    expect(res.status).toBe(400);
  });

  // Lo que compra el LexoRank: colocar una tarea entre otras dos escribe UNA sola fila. Sin esto
  // (posiciones consecutivas) habria que desplazar todas las de debajo en cada movimiento.
  it("inserts between two tasks writing only the moved row", async () => {
    const { owner, workspace, project, tasks } = await setupColumn(3);
    const [first, second, third] = tasks;
    const context = { accessToken: owner.accessToken, workspaceSlug: workspace.slug, projectSlug: project.slug };

    const before = await prisma.task.findMany({
      where: { projectId: project.id },
      select: { id: true, rank: true },
    });

    // La ultima se cuela entre la primera y la segunda.
    const res = await move({ ...context, taskNumber: third.taskNumber, status: "TODO", afterTaskId: first.id });
    expect(res.status).toBe(200);

    const after = await prisma.task.findMany({
      where: { projectId: project.id },
      select: { id: true, rank: true },
    });

    const changed = after.filter((task) => before.find((old) => old.id === task.id)!.rank !== task.rank);
    expect(changed.map((task) => task.id)).toEqual([third.id]);

    // Y el rank nuevo cae estrictamente entre el de sus dos vecinas.
    const rankOf = (id: string) => after.find((task) => task.id === id)!.rank;
    expect(rankOf(first.id) < rankOf(third.id)).toBe(true);
    expect(rankOf(third.id) < rankOf(second.id)).toBe(true);

    await expect(columnOrder({ ...context, status: "TODO" })).resolves.toEqual([first.id, third.id, second.id]);
  });

  // Soltar siempre en el mismo punto acorta el hueco disponible. Con enteros esto acaba agotandose y
  // obliga a renumerar la columna; con LexoRank la cadena simplemente crece y el orden aguanta.
  it("survives repeated drops into the same slot without reordering anything else", async () => {
    const { owner, workspace, project, tasks } = await setupColumn(12);
    const [anchor, ...rest] = tasks;
    const context = { accessToken: owner.accessToken, workspaceSlug: workspace.slug, projectSlug: project.slug };

    for (const task of rest) {
      const res = await move({ ...context, taskNumber: task.taskNumber, status: "TODO", afterTaskId: anchor.id });
      expect(res.status).toBe(200);
    }

    // Cada una entra justo detras del ancla, asi que acaban en orden inverso al de insercion.
    await expect(columnOrder({ ...context, status: "TODO" })).resolves.toEqual([
      anchor.id,
      ...rest.map((task) => task.id).reverse(),
    ]);
  });

  // El caso que motiva el advisory lock. Una tarjeta BAJA cruzando el ancla mientras otra SUBE
  // hasta el mismo hueco: las dos transacciones leen las mismas vecinas y generan el mismo rank.
  // Se repite porque la carrera depende del solape real de las dos transacciones: sin el lock
  // fallan en torno a la mitad de las vueltas, con el no falla ninguna.
  it("keeps ranks distinct when a move crosses an anchor another move is targeting", async () => {
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const project = await createProject(owner.accessToken, workspace.slug);
      const tasks = [];
      for (let index = 0; index < 4; index += 1) {
        tasks.push(await createTask(owner.accessToken, workspace.slug, project.slug, { title: `Task ${index + 1}` }));
      }

      const [first, anchor, , fourth] = tasks;
      const context = { accessToken: owner.accessToken, workspaceSlug: workspace.slug, projectSlug: project.slug };

      const [movedDown, movedUp] = await Promise.all([
        move({ ...context, taskNumber: first.taskNumber, status: "TODO", afterTaskId: anchor.id }),
        move({ ...context, taskNumber: fourth.taskNumber, status: "TODO", afterTaskId: anchor.id }),
      ]);

      expect(movedDown.status).toBe(200);
      expect(movedUp.status).toBe(200);

      const ranks = await prisma.task.findMany({
        where: { projectId: project.id, status: "TODO" },
        select: { rank: true },
      });

      expect(new Set(ranks.map((task) => task.rank)).size).toBe(ranks.length);
    }
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/archive", () => {
  it("forbids a plain project MEMBER from archiving a task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("lets a project manager archive a task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);
  });

  it("400s when the task is already archived", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(400);
  });
});

describe("POST/DELETE /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/favorite", () => {
  it("lets a project member favorite and unfavorite a task", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const favoriteRes = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(favoriteRes.status).toBe(204);

    const afterFavorite = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(afterFavorite.body.isFavorite).toBe(true);

    const unfavoriteRes = await request(app)
      .delete(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(unfavoriteRes.status).toBe(204);

    const afterUnfavorite = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(afterUnfavorite.body.isFavorite).toBe(false);
  });

  it("409s when favoriting a task twice", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(409);
  });

  it("404s when unfavoriting a task that isn't favorited", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);

    const res = await request(app)
      .delete(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("forbids favoriting a task the user is not a project member of", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    const outsider = await signUp();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("marks the task as favorite on the board", async () => {
    const { owner, workspace, project } = await setupOwnerProject();
    const task = await createTask(owner.accessToken, workspace.slug, project.slug);
    await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/${task.taskNumber}/favorite`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}/tasks/board`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.body.find((t: { id: string }) => t.id === task.id).isFavorite).toBe(true);
  });
});
