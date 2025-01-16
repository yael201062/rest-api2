import request from "supertest";
import initApp from "../server";
import mongoose from "mongoose";
import commentsModel from "../models/comment_model";
import postModel from "../models/post_model"; // ייבוא המודל של הפוסטים
import { Express } from "express";

var app: Express;

type User = { email: string; password: string; accessToken?: string; _id?: string };
const testUser: User = {
  email: "test@user.com",
  password: "testpassword",
};

beforeAll(async () => {
  console.log("beforeAll");
  app = await initApp();
  await commentsModel.deleteMany(); // ניקוי התגובות לפני הריצה
  await postModel.deleteMany(); // ניקוי הפוסטים לפני הריצה
  await mongoose.connection.dropDatabase(); // ניקוי מסד הנתונים
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
    expect(response.body.length).toBe(0);
  });

  test("Test Create Comment", async () => {
    // רישום משתמש חדש
    const registerResponse = await request(app).post("/auth/register").send(testUser);
    expect(registerResponse.statusCode).toBe(200);

    // התחברות עם המשתמש שנרשם
    const loginResponse = await request(app).post("/auth/login").send(testUser);
    expect(loginResponse.statusCode).toBe(200);

    const accessToken = loginResponse.body.accessToken;
    testUser.accessToken = accessToken;
    testUser._id = loginResponse.body._id;

    // יצירת פוסט חדש
    const postResponse = await request(app)
      .post("/posts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Test Post",
        content: "Test Content",
        owner: testUser._id,
      });
    expect(postResponse.statusCode).toBe(201);
    postId = postResponse.body._id; // שמירת ה-ID של הפוסט שנוצר

    // יצירת תגובה חדשה ששייכת לפוסט הזה
    const response = await request(app)
      .post("/comments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        comment: "This is a comment", // תוכן התגובה
        owner: testUser._id, // שימוש ב-ID של המשתמש שנרשם
        postId: postId, // שימוש ב-postId שנוצר
      });
    expect(response.statusCode).toBe(201);
    expect(response.body.comment).toBe("This is a comment"); // בדיקה שהתוכן תואם
    expect(response.body.postId).toBe(postId); // בדיקה שה-postId תקין
    expect(response.body.owner).toBe(testUser._id); // בדיקה שהבעלים תואם
    commentId = response.body._id; // שמירת ה-ID של התגובה שנוצרה
  });

  test("Test get comment by owner", async () => {
    // קבלת תגובות לפי בעלים
    const response = await request(app).get("/comments?owner=" + testUser._id);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].comment).toBe("This is a comment"); // בדיקה שהתוכן תואם
    expect(response.body[0].postId).toBe(postId); // בדיקה שה-postId תקין
    expect(response.body[0].owner).toBe(testUser._id); // בדיקה שהבעלים תואם
  });

  test("Comments get post by id", async () => {
    // קבלת תגובה לפי ID
    const response = await request(app).get("/comments/" + commentId);
    expect(response.statusCode).toBe(200);
    expect(response.body.comment).toBe("This is a comment"); // בדיקה שהתוכן תואם
    expect(response.body.postId).toBe(postId); // בדיקה שה-postId תקין
    expect(response.body.owner).toBe(testUser._id); // בדיקה שהבעלים תואם
  });
});