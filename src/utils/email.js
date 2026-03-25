import nodemailer from "nodemailer";
import dotenv from "dotenv";
import logger from "./logger.js";
import config from "../config/env.js";

dotenv.config();

const { email } = config;
// Port 465 uses implicit TLS
const port = Number(email.smtp.port);
const SECURE = port === 465;
// ---- create transporter ----
export const transporter = nodemailer.createTransport({
  host: email.smtp.host,
  port: port,
  secure: SECURE, // true for 587, false for other ports
  auth: {
    user: email.smtp.auth.user,
    pass: email.smtp.auth.pass,
  },
  // Helpful for debugging TLS problems; keep strict in prod
  tls: {
    minVersion: "TLSv1.2",
  },
});
transporter.verify((error) => {
  if (error) logger.error("Mailtrap verify failed:", error);
  else logger.info("Mailtrap SMTP is ready ✅");
});

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - HTML body
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text, html) => {
  const msg = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(msg);
    logger.info(`Email sent ✅ to ${to} | id=${info.messageId}`);
    return info;
  } catch (error) {
    logger.error("Error sending email:", error);
    throw error;
  }
};

/**
 * Send verification email
 * @param {string} to - Recipient email address
 * @param {string} token - Verification token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, otp) => {
  const subject = "Email Verification - Your OTP Code";
  const text = `Your verification code is: ${otp}\n\nThis code will expire in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Verify Your Email</h2>
        <p>Thank you for registering! Please use the following OTP (One-Time Password) to verify your email address:</p>
        
        <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #2c3e50;">${otp}</span>
        </div>
        
        <p style="color: #6c757d; font-size: 14px;">
          This OTP will expire in 10 minutes. Please do not share this code with anyone.
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
          <p>If you didn't request this email, you can safely ignore it.</p>
        </div>
      </div>
    </div>
  `;

  await sendEmail(to, subject, text, html);
};

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} token - Reset token
 * @returns {Promise}
 */

const sendPasswordResetEmail = async (email, otp) => {
  const subject = "Password Reset OTP";
  const text = `Your password reset OTP is: ${otp}\nThis OTP will expire in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>You have requested to reset your password. Use the following OTP to proceed:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="margin: 0; font-size: 28px; letter-spacing: 5px;">${otp}</h1>
      </div>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;

  await sendEmail(email, subject, text, html);
};

const sendResendOTPEmail = async (to, otp) => {
  const subject = "New Verification Code - Your OTP";
  const text = `Your new verification code is: ${otp}\n\nThis code will expire in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">New Verification Code</h2>
        <p>You have requested a new verification code. Here's your new OTP (One-Time Password):</p>
        
        <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #2c3e50;">${otp}</span>
        </div>
        
        <p style="color: #6c757d; font-size: 14px;">
          This OTP will expire in 10 minutes. Please do not share this code with anyone.
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
          <p>If you didn't request this code, please secure your account immediately.</p>
        </div>
      </div>
    </div>
  `;

  await sendEmail(to, subject, text, html);
};

export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendResendOTPEmail,
};
