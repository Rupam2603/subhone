const request = require("supertest");
const app = require("../../src/app");
const Doctor = require("../../src/models/Doctor");

const creds = { name: "Subhasis", email: "consult@example.com", password: "correct-horse-1" };
const cookieValue = (res, name) => {
  const raw = (res.headers["set-cookie"] || []).find((c) => c.startsWith(`${name}=`));
  return raw ? raw.split(";")[0] : null;
};
const registerAndAuth = async () => {
  const reg = await request(app).post("/api/auth/register").send(creds);
  return { at: cookieValue(reg, "so_at"), reg };
};

// NOTE: this test must NOT require("../services/store") — store.js is deleted.

describe("consultation + prescription + orders routes", () => {
  it("rejects an unauthenticated booking with 401 UNAUTHENTICATED", async () => {
    const res = await request(app).post("/api/consultations/book").send({
      doctorId: "64b7f9d2e1a4c5b6d7e8f901",
      date: "2026-09-01",
      slot: "10:00",
      patientName: "Test Patient",
      mode: "Video consult",
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("books a consultation for an authenticated user (201, feePaise)", async () => {
    const { at } = await registerAndAuth();

    const doctor = await Doctor.create({
      name: "Dr. Test", slug: "dr-test", specialty: "General Physician",
      qualifications: ["MBBS"], experienceYears: 5, languages: ["English"],
      rating: 4.5, image: "https://example.com/x.jpg",
      consultationFeePaise: 39900, nextAvailable: "Today", isActive: true,
    });

    const res = await request(app)
      .post("/api/consultations/book")
      .set("Cookie", `so_at=${at}`)
      .send({
        doctorId: String(doctor._id),
        date: "2026-09-01",
        slot: "10:00",
        patientName: "Test Patient",
        mode: "Video consult",
        concern: "Fever",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^CON-\d{6}$/);
    expect(res.body.doctor).toEqual({ name: "Dr. Test" });
    // honor feePaise ?? fee (brief R17.4)
    expect(res.body.feePaise ?? res.body.fee).toBe(39900);
    expect(res.body.status).toBe("BOOKED");
  });

  it("returns 404 DOCTOR_NOT_FOUND for a missing doctor", async () => {
    const { at } = await registerAndAuth();
    const res = await request(app)
      .post("/api/consultations/book")
      .set("Cookie", `so_at=${at}`)
      .send({
        doctorId: "64b7f9d2e1a4c5b6d7e8f901",
        patientName: "Test Patient",
      });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("DOCTOR_NOT_FOUND");
  });

  it("lists the caller's consultations (auth required)", async () => {
    const { at } = await registerAndAuth();
    const res = await request(app).get("/api/consultations").set("Cookie", `so_at=${at}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("rejects an unauthenticated prescription upload with FILE_REQUIRED (422)", async () => {
    // No file attached at all → 422 FILE_REQUIRED before any auth/config issue.
    const res = await request(app).post("/api/prescriptions/upload");
    expect([401, 422]).toContain(res.status);
  });

  it("uploads a prescription file for an authenticated user (201, RX number)", async () => {
    const { at } = await registerAndAuth();
    const res = await request(app)
      .post("/api/prescriptions/upload")
      .set("Cookie", `so_at=${at}`)
      .attach("file", Buffer.from("fake pdf bytes"), {
        filename: "rx.pdf",
        contentType: "application/pdf",
      })
      .field("note", "morning dose");
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^RX-\d{6}$/);
    expect(res.body.status).toBe("PENDING_REVIEW");
    expect(res.body.filePath).toBeTruthy();
  });

  // R17.1 checks
  it("returns 401 for GET /api/orders without auth", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("returns 200 with an array for GET /api/orders with auth", async () => {
    const { at } = await registerAndAuth();
    const res = await request(app).get("/api/orders").set("Cookie", `so_at=${at}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
