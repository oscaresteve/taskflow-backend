import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  addActiveMember,
  addActiveProjectMember,
  app,
  createProject,
  createTask,
  createWorkspace,
  signUp,
} from "../helpers/api.ts";

type SearchBody = {
  workspaces: { slug: string; name: string }[];
  projects: { slug: string; name: string; key: string; workspace: { slug: string; name: string } }[];
  tasks: {
    taskNumber: number;
    title: string;
    project: { key: string; slug: string; name: string };
    workspace: { slug: string; name: string };
  }[];
};

async function search(accessToken: string, query: Record<string, string | number>) {
  return request(app).get("/api/me/search").query(query).set("Cookie", `accessToken=${accessToken}`);
}

// Un termino distinto por test: la base es compartida entre tests del mismo archivo y una palabra
// generica haria que se encontrasen entre ellos.
function unique(prefix: string) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

describe("GET /api/me/search", () => {
  it("cruza las tres entidades en una sola respuesta", async () => {
    const term = unique("zeppelin");
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken, `${term} workspace`);
    const project = await createProject(owner.accessToken, workspace.slug, { name: `${term} project` });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task` });

    const res = await search(owner.accessToken, { search: term });
    const body = res.body as SearchBody;

    expect(res.status).toBe(200);
    expect(body.workspaces.map((w) => w.slug)).toEqual([workspace.slug]);
    expect(body.projects.map((p) => p.slug)).toEqual([project.slug]);
    expect(body.tasks.map((t) => t.title)).toEqual([`${term} task`]);
  });

  it("cada fila trae el contexto necesario para construir su enlace", async () => {
    const term = unique("contexto");
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug, { name: `${term} project` });
    const task = await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task` });

    const body = (await search(owner.accessToken, { search: term })).body as SearchBody;

    expect(body.projects[0].workspace).toEqual({ slug: workspace.slug, name: workspace.name });
    expect(body.tasks[0]).toMatchObject({
      taskNumber: task.taskNumber,
      project: { key: project.key, slug: project.slug },
      workspace: { slug: workspace.slug },
    });
  });

  it("encuentra un proyecto por su key", async () => {
    const key = "ZULU42";
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug, { key });

    const body = (await search(owner.accessToken, { search: key })).body as SearchBody;

    expect(body.projects.map((p) => p.slug)).toContain(project.slug);
  });

  it("no devuelve nada de un espacio del que no eres miembro", async () => {
    const term = unique("ajeno");
    const owner = await signUp();
    const outsider = await signUp();
    const workspace = await createWorkspace(owner.accessToken, `${term} workspace`);
    const project = await createProject(owner.accessToken, workspace.slug, { name: `${term} project` });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task` });

    const body = (await search(outsider.accessToken, { search: term })).body as SearchBody;

    expect(body.workspaces).toEqual([]);
    expect(body.projects).toEqual([]);
    expect(body.tasks).toEqual([]);
  });

  // El caso que de verdad justifica los predicados: ser miembro del espacio no basta para ver las
  // tareas de un proyecto en el que no estas.
  it("no devuelve proyectos ni tareas de un proyecto del que no eres miembro", async () => {
    const term = unique("privado");
    const owner = await signUp();
    const teammate = await signUp();
    const workspace = await createWorkspace(owner.accessToken, `${term} workspace`);
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: teammate.user.id,
      role: "MEMBER",
    });

    const project = await createProject(owner.accessToken, workspace.slug, { name: `${term} project` });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task` });

    const body = (await search(teammate.accessToken, { search: term })).body as SearchBody;

    expect(body.workspaces.map((w) => w.slug)).toEqual([workspace.slug]);
    expect(body.projects).toEqual([]);
    expect(body.tasks).toEqual([]);
  });

  it("devuelve el proyecto y sus tareas en cuanto te añaden al proyecto", async () => {
    const term = unique("invitado");
    const owner = await signUp();
    const teammate = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: teammate.user.id,
      role: "MEMBER",
    });

    const project = await createProject(owner.accessToken, workspace.slug, { name: `${term} project` });
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task` });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: teammate.user.id,
      role: "MEMBER",
    });

    const body = (await search(teammate.accessToken, { search: term })).body as SearchBody;

    expect(body.projects.map((p) => p.slug)).toEqual([project.slug]);
    expect(body.tasks.map((t) => t.title)).toEqual([`${term} task`]);
  });

  it("aplica el limite por entidad", async () => {
    const term = unique("limite");
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);

    for (let i = 0; i < 3; i += 1) {
      await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task ${i}` });
    }

    const body = (await search(owner.accessToken, { search: term, limit: 2 })).body as SearchBody;

    expect(body.tasks).toHaveLength(2);
  });

  it("ignora mayusculas y minusculas", async () => {
    const term = unique("Mayus");
    const owner = await signUp();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.slug);
    await createTask(owner.accessToken, workspace.slug, project.slug, { title: `${term} task` });

    const body = (await search(owner.accessToken, { search: term.toLowerCase() })).body as SearchBody;

    expect(body.tasks.map((t) => t.title)).toEqual([`${term} task`]);
  });

  it("responde 400 si falta el texto de busqueda", async () => {
    const owner = await signUp();

    const res = await search(owner.accessToken, {});

    expect(res.status).toBe(400);
  });

  it("responde 401 sin sesion", async () => {
    const res = await request(app).get("/api/me/search").query({ search: "algo" });

    expect(res.status).toBe(401);
  });
});
