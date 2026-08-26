const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User");

const creds = { name: "Subhasis", email: "addr@example.com", password: "correct-horse-1" };
const payload = {
  fullName: "Subhasis",
  phone: "+919830000000",
  street: "12 Park Street",
  city: "Kolkata",
  state: "West Bengal",
  pinCode: "700016",
};

// Grab a single cookie's value from a supertest response.
const cookieValue = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0] : null;
};

const registerAndAuth = async () => {
  const reg = await request(app).post("/api/auth/register").send(creds);
  return { at: cookieValue(reg, "so_at"), reg };
};

describe("address book routes /api/me/addresses", () => {
  it("rejects unauthenticated access with 401", async () => {
    const res = await request(app).get("/api/me/addresses");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("starts empty and auto-defaults the first address", async () => {
    const { at } = await registerAndAuth();
    const empty = await request(app).get("/api/me/addresses").set("Cookie", `so_at=${at}`);
    expect(empty.status).toBe(200);
    expect(empty.body.addresses).toEqual([]);

    const added = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send(payload);
    expect(added.status).toBe(201);
    expect(added.body.addresses).toHaveLength(1);
    expect(added.body.addresses[0].isDefault).toBe(true);
    expect(added.body.addresses[0].fullName).toBe("Subhasis");
  });

  it("keeps exactly one default when a second is promoted", async () => {
    const { at } = await registerAndAuth();
    const first = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send(payload);
    const firstId = first.body.addresses[0]._id;

    const second = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send({ ...payload, street: "99 Salt Lake" });
    const secondId = second.body.addresses[1]._id;
    // First stays default until explicitly promoted.
    expect(firstId).toBeDefined();
    expect(second.body.addresses.find((a) => a._id === firstId).isDefault).toBe(true);
    expect(second.body.addresses.filter((a) => a.isDefault)).toHaveLength(1);

    const promoted = await request(app).post(`/api/me/addresses/${secondId}/default`)
      .set("Cookie", `so_at=${at}`);
    expect(promoted.status).toBe(200);
    expect(promoted.body.addresses.filter((a) => a.isDefault)).toHaveLength(1);
    expect(promoted.body.addresses.find((a) => a._id === secondId).isDefault).toBe(true);
    expect(promoted.body.addresses.find((a) => a._id === firstId).isDefault).toBe(false);
  });

  it("updates only the supplied fields in place via PATCH", async () => {
    const { at } = await registerAndAuth();
    const created = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send(payload);
    const id = created.body.addresses[0]._id;

    const patched = await request(app).patch(`/api/me/addresses/${id}`)
      .set("Cookie", `so_at=${at}`).send({ city: "Howrah" });
    expect(patched.status).toBe(200);
    const addr = patched.body.addresses[0];
    expect(addr.city).toBe("Howrah");
    expect(addr.street).toBe(payload.street); // untouched
    expect(addr.fullName).toBe(payload.fullName); // untouched
  });

  it("rejects an invalid pinCode with 422", async () => {
    const { at } = await registerAndAuth();
    const res = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send({ ...payload, pinCode: "012345" });
    expect(res.status).toBe(422);
    expect(res.body.details[0].path).toBe("pinCode");
  });

  it("promotes the next address to default when the default is deleted", async () => {
    const { at } = await registerAndAuth();
    const first = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send(payload);
    const firstId = first.body.addresses[0]._id;
    const second = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at}`).send({ ...payload, street: "99 Salt Lake" });
    const secondId = second.body.addresses[1]._id;

    // Delete the default (first); the survivor (second) should become default.
    const del = await request(app).delete(`/api/me/addresses/${firstId}`)
      .set("Cookie", `so_at=${at}`);
    expect(del.status).toBe(200);
    expect(del.body.addresses).toHaveLength(1);
    expect(del.body.addresses[0]._id).toBe(secondId);
    expect(del.body.addresses[0].isDefault).toBe(true);
  });

  it("returns 404 for an unknown address id", async () => {
    const { at } = await registerAndAuth();
    const res = await request(app).delete("/api/me/addresses/64b7f9d2e1a4c5b6d7e8f901")
      .set("Cookie", `so_at=${at}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ADDRESS_NOT_FOUND");
  });

  it("scopes addresses to the owner; a second user cannot touch the first's", async () => {
    const { at: at1 } = await registerAndAuth();
    const created = await request(app).post("/api/me/addresses")
      .set("Cookie", `so_at=${at1}`).send(payload);
    const id = created.body.addresses[0]._id;

    // Register a second user and try to delete the first's address with its id.
    const reg2 = await request(app).post("/api/auth/register")
      .send({ name: "Other", email: "other@example.com", password: "correct-horse-1" });
    const at2 = cookieValue(reg2, "so_at");
    const res = await request(app).delete(`/api/me/addresses/${id}`)
      .set("Cookie", `so_at=${at2}`);
    expect(res.status).toBe(404);
  });
});
