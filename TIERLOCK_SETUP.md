# Tierlock Integration Setup

1. Copy `.env.example` to `.env` and fill all required values.
2. Ensure these Tierlock values are set:
   - `TIERLOCK_API_BASE=https://api.tierlock.com`
   - `TIERLOCK_STAGING_API_BASE=https://stagingapi.tierlock.com`
   - `TIERLOCK_MERCHANT_ID`
   - `TIERLOCK_MERCHANT_SECRET`
   - `TIERLOCK_WEBHOOK_SECRET`
   - `TIERLOCK_HMAC_SECRET`
   - `TIERLOCK_CLIENT_SECRET_BASIC`
3. Install dependencies:
   - `npm install`
4. Start the server:
   - `npm run dev`
5. Verify API routes:
   - `POST /public/api/v1/tierlock/payment-link`
   - `GET /public/api/v1/tierlock/transactions`
   - `GET /public/api/v1/tierlock/transactions/:transaction_id`
   - `GET /public/api/v1/tierlock/transactions/order/:order_id`
   - `POST /public/api/v1/tierlock/payout/send-link`
   - `POST /public/api/v1/tierlock/payout/status`
   - `POST /public/api/v1/tierlock/phone/send-otp`
   - `POST /public/api/v1/tierlock/phone/verify-otp`
   - `POST /public/api/v1/tierlock/whitelist/send-otp`
   - `POST /public/api/v1/tierlock/whitelist/verify-otp`
   - `GET /public/api/v1/tierlock/whitelist`
   - `DELETE /public/api/v1/tierlock/whitelist/:whitelist_id`
   - `POST /public/api/v1/tierlock/webhook`
6. Webhook route parsing:
   - Tierlock webhook route uses raw JSON body parsing before global `express.json()` middleware.
   - Signature headers used: `x-webhook-signature`, `x-webhook-timestamp`.

