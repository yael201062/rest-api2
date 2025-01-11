import commentsModel, { IComments } from "../models/comment_model";
import { Request, Response } from "express";
import BaseController from "./base_controller";

const commentsController = new BaseController<IComments>(commentsModel);

export default commentsController;
