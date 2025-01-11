import { NextFunction, Request, Response } from 'express';
import userModel, { IUser } from '../models/user_model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Document } from 'mongoose';

// Registration
const register = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = await userModel.create({ email, password: hashedPassword });
        res.status(200).send(user);
    } catch (err) {
        res.status(400).send(err);
    }
};

// Token Generation
type tTokens = {
    accessToken: string;
    refreshToken: string;
};

const generateToken = (userId: string): tTokens | null => {
    if (!process.env.TOKEN_SECRET) {
        return null;
    }

    const random = Math.random().toString();
    const accessToken = jwt.sign(
        { _id: userId, random },
        process.env.TOKEN_SECRET,
        { expiresIn: process.env.TOKEN_EXPIRES }
    );

    const refreshToken = jwt.sign(
        { _id: userId, random },
        process.env.TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
    );

    return { accessToken, refreshToken };
};

// Login
const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).send('Wrong username or password');
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).send('Wrong username or password');
        }

        const tokens = generateToken(user._id);
        if (!tokens) {
            return res.status(500).send('Server Error');
        }

        if (!user.refreshToken) {
            user.refreshToken = [];
        }
        user.refreshToken.push(tokens.refreshToken);
        await user.save();

        res.status(200).send({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            _id: user._id
        });
    } catch (err) {
        res.status(400).send(err);
    }
};

// Verify Refresh Token
type tUser = Document<unknown, {}, IUser> & IUser & Required<{ _id: string }> & { __v: number };

const verifyRefreshToken = async (refreshToken: string | undefined): Promise<tUser | null> => {
    return new Promise<tUser | null>((resolve, reject) => {
        if (!refreshToken) {
            return reject('fail');
        }

        if (!process.env.TOKEN_SECRET) {
            return reject('fail');
        }

        jwt.verify(refreshToken, process.env.TOKEN_SECRET, async (err: any, payload: any) => {
            if (err) {
                return reject('fail');
            }

            const userId = payload._id;
            try {
                const user = await userModel.findById(userId);
                if (!user || !user.refreshToken || !user.refreshToken.includes(refreshToken)) {
                    if (user) user.refreshToken = [];
                    await user?.save();
                    return reject('fail');
                }

                // Remove the used refresh token
                user.refreshToken = user.refreshToken.filter((token) => token !== refreshToken);
                await user.save();
                resolve(user);
            } catch (err) {
                reject('fail');
            }
        });
    });
};

// Logout
const logout = async (req: Request, res: Response) => {
    try {
        const user = await verifyRefreshToken(req.body.refreshToken);
        if (user) {
            res.status(200).send('success');
        } else {
            res.status(400).send('fail');
        }
    } catch (err) {
        res.status(400).send('fail');
    }
};

// Refresh Token
const refresh = async (req: Request, res: Response) => {
    try {
        const user = await verifyRefreshToken(req.body.refreshToken);
        if (!user) {
            return res.status(400).send('fail');
        }

        const tokens = generateToken(user._id);
        if (!tokens) {
            return res.status(500).send('Server Error');
        }

        if (!user.refreshToken) {
            user.refreshToken = [];
        }
        user.refreshToken.push(tokens.refreshToken);
        await user.save();

        res.status(200).send({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            _id: user._id
        });
    } catch (err) {
        res.status(400).send('fail');
    }
};

// Authentication Middleware
type Payload = {
    _id: string;
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization');
    const token = authorization && authorization.split(' ')[1];

    if (!token) {
        return res.status(401).send('Access Denied');
    }

    if (!process.env.TOKEN_SECRET) {
        return res.status(500).send('Server Error');
    }

    jwt.verify(token, process.env.TOKEN_SECRET, (err, payload) => {
        if (err) {
            return res.status(401).send('Access Denied');
        }

        req.params.userId = (payload as Payload)._id;
        next();
    });
};

export default {
    register,
    login,
    refresh,
    logout
};
