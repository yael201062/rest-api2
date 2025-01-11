import { Request, Response } from "express";
import { Model } from "mongoose";

class BaseController<T> {
    model: Model<T>;

    constructor(model: any) {
        this.model = model;
    }

    async getAll(req: Request, res: Response) {
        const filter = req.query.owner;
        try {
            const items = filter
                ? await this.model.find({ owner: filter })
                : await this.model.find();
            res.send(items);
        } catch (error) {
            res.status(400).send(error);
        }
    }

    async getById(req: Request, res: Response) {
        const id = req.params.id;
        try {
            const item = await this.model.findById(id);
            if (item) {
                res.send(item);
            } else {
                res.status(404).send("Not found");
            }
        } catch (error) {
            res.status(400).send(error);
        }
    }

    async create(req: Request, res: Response) {
        const body = { ...req.body, owner: req.params.userId }; // Attach userId as owner
        try {
            const item = await this.model.create(body);
            res.status(201).send(item);
        } catch (error) {
            res.status(400).send(error);
        }
    }

    async deleteItem(req: Request, res: Response) {
        const id = req.params.id;
        try {
            await this.model.findByIdAndDelete(id);
            res.status(200).send("Deleted");
        } catch (error) {
            res.status(400).send(error);
        }
    }
}

export default BaseController;
