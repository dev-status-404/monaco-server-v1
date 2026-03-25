import createError from "http-errors";
import User from "../models/user.model.js";
import { OAuth2Client } from "google-auth-library";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";
import config from "../config/env.js";
import { sendPasswordResetEmail } from "../utils/email.js";

var googleClient = new OAuth2Client(config.google.clientId);

async function register(userDetail) {
  const existing = await User.findOne({ where: { email: userDetail.email } });
  if (existing) throw createError(409, "user-already-exists");
  const passwordHash = await hashPassword(userDetail.password);
  const email = userDetail.email.toLowerCase();
  const type = userDetail.type ?? "user";
  const user = await User.create({
    ...userDetail,
    email,
    type,
    auth_provider: "local",
    password: passwordHash,
  });

  let redirect = "/auth/signin";

  const token = generateToken(
    {
      sub: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      blocked: user.blocked,
      avatar_url: user.avatar_url,
      type: user.type,
    },
    "1h",
  );
  return {
    success: true,
    code: 201,
    data: {
      user,
      redirect,
      token,
    },
    message: "account-created",
  };
}

async function login({ email, password }) {
  let redirect;

  const user = await User.findOne({
    where: { email, blocked: false, active: true },
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "blocked",
      "password",
      "avatar_url",
      "createdAt",
      "updatedAt",
      "role",
    ],
  });
  if (!user) throw createError(401, "user-not-found");
  if (user.blocked) throw createError(401, "user-blocked");
  const match = await comparePassword(password, user.password);
  if (!match) throw createError(401, "invalid-password");
  const token = generateToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      blocked: user.blocked,
      type: "user",
    },
    "1h",
  );

  const SignedInUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    token: token,
    role: user.role,
    blocked: user.blocked,
    avatar_url: user.avatar_url,
  };

  if (user.role === "admin") redirect = `/dashboard/a/${user.id}`;
  if (user.role === "user") redirect = `/dashboard/u/${user.id}`;

  return {
    data: {
      user: SignedInUser,
      redirect,
    },
    code: 200,
    sucess: true,
    message: "signin-successful",
  };
}

async function googleLogin({ credential }) {
  let token;

  if (!credential)
    return {
      success: false,
      code: 400,
      data: null,
      message: "google-login-failed",
    };

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.google.clientId,
  });

  if (!ticket)
    return {
      code: 400,
      success: false,
      message: "google-login-failed",
      data: null,
    };

  const payload = ticket.getPayload();
  const { email, given_name, picture, family_name } = payload;

  const user = await User.findOne({
    where: { email: email },
    attributes: [
      "id",
      "firstName",
      "lastName",
      "email",
      "blocked",
      "avatar_url",
      "createdAt",
      "updatedAt",
      "role",
    ],
  });

  if (user) {
    token = generateToken(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        blocked: user.blocked,
        type: "user",
      },
      "1h",
    );
    return {
      success: true,
      message: "google-login-successful",
      data: user,
      token,
    };
  }

  const passwordHash = await hashPassword(email);
  const newUser = await User.create({
    firstName: given_name,
    lastName: family_name,
    email: email,
    password: passwordHash,
    avatar_url: picture,
  });
  token = generateToken(
    {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
      blocked: newUser.blocked,
      type: "user",
    },
    "1h",
  );

  return {
    success: true,
    message: "google-signup-successful",
    data: newUser,
    token: token,
  };
}

async function forgotPassword(email) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw createError(404, "user-not-found");

  const otp = Math.floor(100000 + Math.random() * 900000);

  const sentEmail = await sendPasswordResetEmail(email, otp);
  console.log(sentEmail);

  user.reset_otp = otp;
  user.reset_otp_expiry = Date.now() + 5 * 60 * 1000;

  await user.save();

  return {
    success: true,
    message: "user-found",
    data: { user },
    redirect: `/auth/reset-password/${user.id}`,
    code: 200,
  };
}

async function resetPassword(data) {
  const { password, otp } = data;

  if (!password) throw createError(400, `password-required`);
  if (!otp) throw createError(400, `otp-required`);

  const passwordHash = await hashPassword(password);

  const userExists = await User.findOne({ where: { reset_otp: otp } });

  if (!userExists) throw createError(400, `user-not-found`);
  if (userExists.reset_otp !== otp) throw createError(400, `invalid-reset_otp`);
  if (userExists.reset_otp_expires < Date.now())
    throw createError(400, `reset_otp-expired`);

  userExists.password = passwordHash;
  userExists.reset_otp = null;
  userExists.reset_otp_expiry = null;
  await userExists.save();

  return {
    success: true,
    message: "password-reset-successful",
    data: userExists,
    code: 200,
  };
}

export const authService = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
};
