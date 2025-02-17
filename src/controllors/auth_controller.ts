import { NextFunction, Request, Response } from 'express';
import userModel, { IUser } from '../models/user_model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Document } from 'mongoose';

type Payload = {
    exp: number;
    _id: string;
};

// Registration
const register = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = await userModel.create({ email, password: hashedPassword });
        res.status(200).send(user);
    } catch (err) {
        res.status(400).json({ message: "Registration failed", error: err });
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
      { expiresIn: process.env.TOKEN_EXPIRES || '1h' }
    );
  
    const refreshToken = jwt.sign(
      { _id: userId, random },
      process.env.TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d' }
    );
  
    return { accessToken, refreshToken };
  };


// Login
const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "Wrong username or password" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: "Wrong username or password" });
        }

        const tokens = generateToken(user._id);
        if (!tokens) {
            return res.status(500).json({ message: "Server Error" });
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
        res.status(400).json({ message: "Login failed", error: err });
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
  
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
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
            return res.status(400).json({ message: "fail" });
        }

        const tokens = generateToken(user._id);
        if (!tokens) {
            return res.status(500).json({ message: "Server Error" });
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
        res.status(400).json({ message: "fail" });
    }
};

// Authentication Middleware
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
  
      const currentTime = Math.floor(Date.now() / 1000);
      if ((payload as Payload).exp < currentTime) {
        return res.status(401).send('Token Expired');
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
