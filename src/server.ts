import dotenv from "dotenv"
dotenv.config();
import mongoose from "mongoose";
import bodyParser from "body-parser";
import express, { Express } from "express";
import postsRoute from "./routes/post_routes";
import commentsRoute from "./routes/comment_routes";
import authRoutes from "./routes/auth_routes";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/posts", postsRoute);
app.use("/comments", commentsRoute);
app.use("/auth", authRoutes);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Web Dev 2025 REST API",
      version: "1.0.0",
      description: "REST server including authentication using JWT",
    },
    servers: [{ url: "http://localhost:3000", },],
  },
  apis: ["./src/routes/*.ts"],
};
const specs = swaggerJsDoc(options);
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));

const db = mongoose.connection;
db.on("error", (error) => console.error(error));
db.once("open", () => console.log("Connected to database"));

const initApp = () => {
  return new Promise<Express>((resolve, reject) => {
    if (!process.env.DB_CONNECT) {
      reject("DB_CONNECT is not defined in .env file");
    } else {
      mongoose
        .connect(process.env.DB_CONNECT)
        .then(() => {
          resolve(app);
        })
        .catch((error) => {
          reject(error);
        });
    }
  });
};

export default initApp;