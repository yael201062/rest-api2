import request from "supertest";
import initApp from "../server";
import mongoose from "mongoose";
import commentsModel from "../models/comment_model";
import postModel from "../models/post_model";
import { Express } from "express";
import testComments from "./test_comments.json";

var app: Express;

type User = { email: string; password: string; accessToken?: string; _id?: string };
const testUser: User = {
  email: "test@user.com",
  password: "testpassword",
};

beforeAll(async () => {
  console.log("beforeAll");
  app = await initApp();
  await commentsModel.deleteMany();
  await postModel.deleteMany();
  await mongoose.connection.dropDatabase();

  const post = await postModel.create({
    title: "Existing Post",
    content: "Content from test_comments.json",
    owner: testUser._id || "dummyOwnerId",
  });

  postId = post._id.toString();

  await commentsModel.insertMany(
    testComments.map((comment) => ({
      ...comment,
      postId,
    }))
  );
});

afterAll((done) => {
  console.log("afterAll");
  mongoose.connection.close();
  done();
});

let commentId = "";
let postId = "";

describe("Comments Tests", () => {
  test("Comments test get all", async () => {
    const response = await request(app).get("/comments");
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(testComments.length);
  });

  test("Test Create Comment", async () => {
    const registerResponse = await request(app).post("/auth/register").send(testUser);
    expect(registerResponse.statusCode).toBe(200);

    const loginResponse = await request(app).post("/auth/login").send(testUser);
    expect(loginResponse.statusCode).toBe(200);

    const accessToken = loginResponse.body.accessToken;
    testUser.accessToken = accessToken;
    testUser._id = loginResponse.body._id;

    const response = await request(app)
      .post("/comments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        comment: "This is a new comment",
        owner: testUser._id,
        postId: postId, // שימוש ב-postId ממסד הנתונים
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.comment).toBe("This is a new comment");
    expect(response.body.postId).toBe(postId);
    expect(response.body.owner).toBe(testUser._id);
    commentId = response.body._id;
  });

  test("Test get comment by owner", async () => {
    const response = await request(app).get("/comments?owner=" + testUser._id);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1); // מצפה לתגובה שנוצרה בטסט הקודם
    expect(response.body[0].comment).toBe("This is a new comment");
    expect(response.body[0].postId).toBe(postId);
    expect(response.body[0].owner).toBe(testUser._id);
  });

  test("Comments get post by id", async () => {
    const response = await request(app).get("/comments/" + commentId);
    expect(response.statusCode).toBe(200);
    expect(response.body.comment).toBe("This is a new comment");
    expect(response.body.postId).toBe(postId);
    expect(response.body.owner).toBe(testUser._id);
  });
});
