const Joi = require("joi");

function applySchema(schema, source, res, fieldName) {
  const { value, error } = schema.validate(source, {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
    stripUnknown: false,
  });

  if (!error) {
    return { ok: true, value };
  }

  res.status(400).json({
    success: false,
    message: `Entree invalide dans ${fieldName}.`,
    details: error.details.map((detail) => detail.message),
  });

  return { ok: false };
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = applySchema(schema, req.body || {}, res, "le corps de la requete");
    if (!result.ok) return;
    req.body = result.value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = applySchema(schema, req.query || {}, res, "les parametres de requete");
    if (!result.ok) return;
    req.query = result.value;
    next();
  };
}

const couponGenerateSchema = Joi.object({
  size: Joi.number().integer().min(1).max(20).default(3),
  league: Joi.string().trim().max(120).default("all"),
  risk: Joi.string().trim().max(32).default("balanced"),
  stake: Joi.number().min(0).default(1000),
}).unknown(true);

const couponValidateSchema = Joi.object({
  driftThresholdPercent: Joi.number().min(0).max(100).default(6),
  coupon: Joi.object().unknown(true),
}).unknown(true);

const couponFavoriteSchema = Joi.object({
  couponId: Joi.string().trim().min(1).max(255).required(),
  userId: Joi.string().trim().max(120).default("anonymous"),
  coupon: Joi.object().unknown(true).default({}),
}).unknown(true);

const watchlistQuerySchema = Joi.object({
  userId: Joi.string().trim().max(120).default("default"),
  limit: Joi.number().integer().min(1).max(200).default(20),
}).unknown(true);

const watchlistSchema = Joi.object({
  userId: Joi.string().trim().max(120).default("default"),
  matchIds: Joi.array().items(Joi.string().trim().min(1).max(80)).max(300),
  addMatchId: Joi.string().trim().max(80),
  removeMatchId: Joi.string().trim().max(80),
  snapshot: Joi.object().unknown(true),
}).unknown(true);

const mobileDeviceRegisterSchema = Joi.object({
  deviceId: Joi.string().trim().min(1).max(255).required(),
  userId: Joi.string().trim().max(120),
  platform: Joi.string().trim().lowercase().valid("android", "ios", "web", "unknown").default("android"),
  pushToken: Joi.string().trim().max(2000),
  fcmToken: Joi.string().trim().max(2000),
  appVersion: Joi.string().trim().max(120),
  meta: Joi.object().unknown(true),
}).unknown(true);

const patternsReportSchema = Joi.object({
  matches: Joi.array().items(Joi.object().unknown(true)).default([]),
  minRulePlayed: Joi.number().integer().min(1).default(5),
  totalValidated: Joi.number().integer().min(1),
}).unknown(true);

const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
  history: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid("user", "assistant").default("assistant"),
        text: Joi.string().trim().max(600).default(""),
      }).unknown(true)
    )
    .max(12)
    .default([]),
  context: Joi.object({
    page: Joi.string().trim().max(80).default("site"),
    matchId: Joi.string().trim().max(60).allow("").default(""),
    league: Joi.string().trim().max(120).allow("").default(""),
    pageSnapshot: Joi.any(),
    capabilities: Joi.object({
      actions: Joi.array().items(Joi.string().trim().max(80)).max(40).default([]),
    }).unknown(true),
  })
    .unknown(true)
    .default({}),
}).unknown(true);

const printCouponSchema = Joi.object({
  coupon: Joi.array().default([]),
}).unknown(true);

const updateHistorySchema = Joi.object({
  version: Joi.string().trim().max(120).allow("").default(""),
  title: Joi.string().trim().min(2).max(255).required(),
  summary: Joi.string().trim().max(500).allow("").default(""),
  details: Joi.string().trim().max(4000).allow("").default(""),
  highlights: Joi.array()
    .items(Joi.string().trim().min(1).max(200))
    .max(20)
    .default([]),
  category: Joi.string().trim().max(120).allow("").default(""),
  author: Joi.string().trim().max(255).allow("").default(""),
  pinned: Joi.boolean().default(false),
}).unknown(true);

const authRegisterSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  username: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().trim().min(8).max(200).required(),
  planKey: Joi.string().trim().max(50).default("free"),
}).unknown(true);

const authLoginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().trim().min(8).max(200).required(),
}).unknown(true);

const adminUserUpdateSchema = Joi.object({
  email: Joi.string().trim().email(),
  username: Joi.string().trim().min(2).max(80),
  password: Joi.string().trim().min(8).max(200),
  role: Joi.string().trim().valid("user", "admin"),
  planKey: Joi.string().trim().max(50),
  status: Joi.string().trim().valid("active", "suspended", "blocked"),
  subscriptionStatus: Joi.string().trim().valid("active", "past_due", "canceled", "trialing"),
  quotaOverrideDaily: Joi.number().integer().min(0).allow(null),
  quotaOverrideMonthly: Joi.number().integer().min(0).allow(null),
}).unknown(true);

const adminUserCreateSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  username: Joi.string().trim().min(2).max(80).required(),
  password: Joi.string().trim().min(8).max(200).required(),
  role: Joi.string().trim().valid("user", "admin").default("user"),
  planKey: Joi.string().trim().max(50).default("free"),
  status: Joi.string().trim().valid("active", "suspended", "blocked").default("active"),
  subscriptionStatus: Joi.string().trim().valid("active", "past_due", "canceled", "trialing").default("active"),
  quotaOverrideDaily: Joi.number().integer().min(0).allow(null),
  quotaOverrideMonthly: Joi.number().integer().min(0).allow(null),
}).unknown(true);

module.exports = {
  validateBody,
  validateQuery,
  couponGenerateSchema,
  couponValidateSchema,
  couponFavoriteSchema,
  watchlistQuerySchema,
  watchlistSchema,
  mobileDeviceRegisterSchema,
  patternsReportSchema,
  chatSchema,
  printCouponSchema,
  updateHistorySchema,
  authRegisterSchema,
  authLoginSchema,
  adminUserUpdateSchema,
  adminUserCreateSchema,
};
