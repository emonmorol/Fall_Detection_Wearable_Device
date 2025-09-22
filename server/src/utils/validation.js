import Joi from 'joi';

export const readingSchema = Joi.object({
  deviceId: Joi.string().required(),
  ts: Joi.number().integer().min(1600000000000).required(),
  hr: Joi.number().integer().min(0).max(250).required(),
  spo2: Joi.number().integer().min(0).max(100).required(),
  flags: Joi.object({
    hrLow: Joi.boolean().required(),
    hrHigh: Joi.boolean().required(),
    spo2Low: Joi.boolean().required(),
  }).required(),
});

export const registerDeviceSchema = Joi.object({
  deviceId: Joi.string().required(),
  name: Joi.string().allow(''),
  secret: Joi.string().min(16).required(),
});
