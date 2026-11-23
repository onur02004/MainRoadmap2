import * as userService from "../services/userService.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import logger from "../utils/logger.js";
import { registerSchema } from "../utils/validators.js";
import { query } from "../config/db.js";

export const register = async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        status: "error",
        message: "Kayıt bilgileri geçersiz.",
        issues: parsed.error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        })),
      });
    }
    const { user_name, email, password, relation } = parsed.data;
    const real_name =
      typeof req.body.real_name === "string"
        ? req.body.real_name.trim().slice(0, 80)
        : null;

    // Check if user exists
    const existingUser = await userService.findUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const newUser = await userService.createUser({
      user_name,
      email,
      password,
      real_name,
      relation,
    });

    // Generate Token

    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    logger.info("REGISTER", `User registered: ${newUser.email}`);

    return res.status(201).json({
      status: "success",
      data: {
        user: newUser,
        // Non-secret compatibility sentinel. The real JWT stays in the HttpOnly cookie.
        token: "cookie-session",
      },
    });
  } catch (error) {
    if (error.code === "23505")
      return res.status(409).json({
        status: "error",
        message: "Bu kullanıcı adı veya e-posta zaten kullanılıyor.",
      });
    logger.error("REGISTER", "error registering user", {
      name: error.name,
      code: error.code,
    });
    return res
      .status(500)
      .json({ status: "error", message: "Kayıt sırasında bir hata oluştu." });
  }
};

export const login = async (req, res) => {
  try {
    const identifier = String(
      req.body?.identifier || req.body?.user_name || "",
    ).trim();
    const password = req.body?.password;
    if (
      !identifier ||
      identifier.length > 254 ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 128
    ) {
      return res
        .status(400)
        .json({ status: "error", message: "Giriş bilgileri geçersiz." });
    }
    const user = await userService.findUserByIdentifier(identifier);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Record successful login for admin activity history.
    await query(
      `INSERT INTO user_login_events (user_id)
   VALUES ($1)`,
      [user.id],
    );

    await query("UPDATE users SET last_online = NOW() WHERE id = $1", [
      user.id,
    ]);

    logger.info("LOGIN", `User logged in: ${user.user_name}`);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      status: "success",
      token: "cookie-session",
      data: { token: "cookie-session" },
    });
  } catch (error) {
    logger.warn("LOGIN", "Login failed", {
      name: error.name,
      code: error.code,
    });
    return res
      .status(500)
      .json({ status: "error", message: "Giriş sırasında bir hata oluştu." });
  }
};

export const changePassword = async (req, res) => {
  try {
    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;
    const confirmPassword = req.body?.confirmPassword;

    if (
      typeof currentPassword !== "string" ||
      currentPassword.length < 1 ||
      currentPassword.length > 128 ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      newPassword.length > 128 ||
      newPassword !== confirmPassword ||
      newPassword === currentPassword
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Yeni parola en az 8, en fazla 128 karakter olmalı ve doğrulamayla eşleşmelidir.",
      });
    }

    if (
      !req.user?.password_hash ||
      !(await bcrypt.compare(currentPassword, req.user.password_hash))
    ) {
      return res
        .status(400)
        .json({ status: "error", message: "Mevcut parola doğru değil." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await userService.updatePassword(
      req.user.id || req.user._id,
      passwordHash,
    );
    if (!result)
      return res
        .status(404)
        .json({ status: "error", message: "Kullanıcı bulunamadı." });

    const token = jwt.sign({ id: result.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });
    return res
      .status(200)
      .json({ status: "success", message: "Parolan güncellendi." });
  } catch (error) {
    logger.error("PASSWORD", "Password update failed", {
      name: error.name,
      code: error.code,
    });
    return res.status(500).json({
      status: "error",
      message: "Parola güncellenirken bir hata oluştu.",
    });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res
    .status(200)
    .json({ status: "success", message: "Oturum kapatıldı." });
};
