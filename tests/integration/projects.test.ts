import { describe, expect, it } from "vitest";
import request from "supertest";
import { addActiveMember, addActiveProjectMember, app, createProject, createWorkspace, signUp } from "../helpers/api.ts";

async function setupOwnerWorkspace() {
  const owner = await signUp();
  const workspace = await createWorkspace(owner.accessToken);
  return { owner, workspace };
}

describe("POST /workspaces/:workspaceSlug/projects", () => {
  it("lets a workspace manager create a project and makes them the project OWNER", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ name: "Website Redesign", key: "WEB" });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("website-redesign");

    const members = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${res.body.slug}/members`)
      .set("Cookie", `accessToken=${owner.accessToken}`);
    expect(members.body.data).toContainEqual(expect.objectContaining({ userId: owner.user.id, role: "OWNER" }));
  });

  it("forbids a plain workspace MEMBER from creating a project", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ name: "Some Project", key: "SOME" });

    expect(res.status).toBe(403);
  });

  it("409s when the project key already exists in the workspace", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    await createProject(owner.accessToken, workspace.slug, { key: "DUP" });

    const res = await request(app)
      .post(`/api/workspaces/${workspace.slug}/projects`)
      .set("Cookie", `accessToken=${owner.accessToken}`)
      .send({ name: "Another Project", key: "DUP" });

    expect(res.status).toBe(409);
  });
});

describe("GET /workspaces/:workspaceSlug/projects", () => {
  it("only lists projects the user is a member of", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const mine = await createProject(owner.accessToken, workspace.slug, { key: "MINE" });
    await createProject(owner.accessToken, workspace.slug, { key: "OTHR" });

    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "ADMIN",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: mine.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    const slugs = res.body.data.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual([mine.slug]);
  });

  it("excludes projects where the user's membership was deactivated", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug, { key: "GONE" });
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
      .get(`/api/workspaces/${workspace.slug}/projects`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.body.data).toEqual([]);
  });
});

describe("GET /workspaces/:workspaceSlug/projects/:projectSlug", () => {
  it("returns the project's own fields, without embedding workspace, members or tasks", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: project.id, slug: project.slug }));
    expect(res.body.workspace).toBeUndefined();
    expect(res.body.members).toBeUndefined();
    expect(res.body.tasks).toBeUndefined();
  });

  it("403s when the user is a workspace member but not a project member", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);
    const memberUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: memberUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("403s when the user's project membership was deactivated", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);
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
      .get(`/api/workspaces/${workspace.slug}/projects/${project.slug}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug", () => {
  it("forbids a project OWNER who is only a workspace MEMBER (permission is workspace-level)", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);
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
      role: "OWNER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}`)
      .set("Cookie", `accessToken=${memberUser.accessToken}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(403);
  });

  it("lets a workspace ADMIN who is only a project MEMBER update the project", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);
    const adminUser = await signUp();
    await addActiveMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      targetUserId: adminUser.user.id,
      role: "ADMIN",
    });
    await addActiveProjectMember({
      managerAccessToken: owner.accessToken,
      workspaceSlug: workspace.slug,
      projectSlug: project.slug,
      targetUserId: adminUser.user.id,
      role: "MEMBER",
    });

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}`)
      .set("Cookie", `accessToken=${adminUser.accessToken}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
  });
});

describe("PATCH /workspaces/:workspaceSlug/projects/:projectSlug/archive", () => {
  it("lets a workspace manager archive the project", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(204);
  });

  it("404s on a second archive (an archived project is no longer reachable by slug)", async () => {
    const { owner, workspace } = await setupOwnerWorkspace();
    const project = await createProject(owner.accessToken, workspace.slug);
    await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    const res = await request(app)
      .patch(`/api/workspaces/${workspace.slug}/projects/${project.slug}/archive`)
      .set("Cookie", `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(404);
  });
});
