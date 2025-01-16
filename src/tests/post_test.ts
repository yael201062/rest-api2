import request from "supertest";
import initApp from "../server";
import mongoose from "mongoose";
import postModel from "../models/post_model";
import { Express } from "express";
import userModel, { IUser } from "../models/user_model";

var app: Express;

type User = IUser & { accessToken?: string };
const testUser: User = {
  email: "test@user.com",
  password: "testpassword",
}

beforeAll(async () => {
  console.log("beforeAll");
  app = await initApp();
  await postModel.deleteMany();
  await userModel.deleteMany();

  const registerResponse = await request(app).post("/auth/register").send(testUser);
  expect(registerResponse.statusCode).toBe(200);

  const loginResponse = await request(app).post("/auth/login").send(testUser);
  expect(loginResponse.statusCode).toBe(200);

  testUser.accessToken = loginResponse.body.accessToken; // תיקון כאן
  testUser._id = loginResponse.body._id;
  expect(testUser.accessToken).toBeDefined(); // תיקון כאן
});

afterAll((done) => {
  console.log("afterAll");
  mongoose.connection.close();
  done();
});

let postId = "";
describe("Posts Tests", () => {
  test("Posts test get all", async () => {
    const response = await request(app).get("/posts");
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(0);
  });

  test("Test Create Post", async () => {
    const response = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${testUser.accessToken}`) // תיקון כאן
      .send({
        title: "Test Post",
        content: "Test Content",
        owner: testUser._id,
      });
    expect(response.statusCode).toBe(201);
    expect(response.body.title).toBe("Test Post");
    expect(response.body.content).toBe("Test Content");
    postId = response.body._id;
  });

  test("Test get post by owner", async () => {
    const response = await request(app).get("/posts?owner=" + testUser._id);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].title).toBe("Test Post");
    expect(response.body[0].content).toBe("Test Content");
  });

  test("Test get post by id", async () => {
    const response = await request(app).get("/posts/" + postId);
    expect(response.statusCode).toBe(200);
    expect(response.body.title).toBe("Test Post");
    expect(response.body.content).toBe("Test Content");
  });

  test("Test Create Post 2", async () => {
    const response = await request(app).post("/posts")
      .set({ authorization: "Bearer " + testUser.accessToken }) // תיקון כאן
      .send({
        title: "Test Post 2",
        content: "Test Content 2",
        owner: "TestOwner2",
      });
    expect(response.statusCode).toBe(201);
  });

  test("Posts test get all 2", async () => {
    const response = await request(app).get("/posts");
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
  });

  test("Test Delete Post", async () => {
    const response = await request(app)
      .delete(`/posts/${postId}`)
      .set("Authorization", `Bearer ${testUser.accessToken}`); // תיקון כאן
    expect(response.statusCode).toBe(200);

    const response2 = await request(app).get(`/posts/${postId}`);
    expect(response2.statusCode).toBe(404);
  });

  test("Test Create Post fail", async () => {
    const response = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${testUser.accessToken}`) // תיקון כאן
      .send({
        content: "Test Content 2",
      });
    expect(response.statusCode).toBe(400);
  });
});