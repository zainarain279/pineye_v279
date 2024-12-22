require("dotenv").config();
const { _isArray } = require("../utils.js");

const settings = {
  TIME_SLEEP: process.env.TIME_SLEEP ? parseInt(process.env.TIME_SLEEP) : 8,
  MAX_THEADS: process.env.MAX_THEADS ? parseInt(process.env.MAX_THEADS) : 10,
  MAX_LEVEL_TAP_UPGRADE: process.env.MAX_LEVEL_TAP_UPGRADE ? parseInt(process.env.MAX_LEVEL_TAP_UPGRADE) : 10,
  MAX_COST_UPGRADE: process.env.MAX_COST_UPGRADE ? parseInt(process.env.MAX_COST_UPGRADE) : 1000000,
  SKIP_TASKS: process.env.SKIP_TASKS ? JSON.parse(process.env.SKIP_TASKS.replace(/'/g, '"')) : [],
  AUTO_TASK: process.env.AUTO_TASK ? process.env.AUTO_TASK.toLowerCase() === "true" : false,
  AUTO_UPGRADE_BOOSTER: process.env.AUTO_UPGRADE_BOOSTER ? process.env.AUTO_UPGRADE_BOOSTER.toLowerCase() === "true" : false,
  DAILY_COMBO: process.env.DAILY_COMBO ? process.env.DAILY_COMBO.toLowerCase() === "true" : false,
  DAILY_COMBO_CODE: process.env.DAILY_COMBO_CODE ? process.env.DAILY_COMBO_CODE : null,
  AUTO_UPGRADE: process.env.AUTO_UPGRADE ? process.env.AUTO_UPGRADE.toLowerCase() === "true" : false,
  AUTO_TAP: process.env.AUTO_TAP ? process.env.AUTO_TAP.toLowerCase() === "true" : false,
  AUTO_QUEST: process.env.AUTO_QUEST ? process.env.AUTO_QUEST.toLowerCase() === "true" : false,
  BASE_URL: process.env.BASE_URL ? process.env.BASE_URL : null,
  BASE_URL_AUTH: process.env.BASE_URL_AUTH ? process.env.BASE_URL_AUTH : null,
  ADVANCED_ANTI_DETECTION: process.env.ADVANCED_ANTI_DETECTION ? process.env.ADVANCED_ANTI_DETECTION.toLowerCase() === "true" : false,
  AUTO_PRACTICE: process.env.AUTO_PRACTICE ? process.env.AUTO_PRACTICE.toLowerCase() === "true" : false,

  AUTO_BUY_LOTTERY: process.env.AUTO_BUY_LOTTERY ? process.env.AUTO_BUY_LOTTERY.toLowerCase() === "true" : false,
  CONNECT_WALLET: process.env.CONNECT_WALLET ? process.env.CONNECT_WALLET.toLowerCase() === "true" : false,
  DELAY_BETWEEN_REQUESTS: process.env.DELAY_BETWEEN_REQUESTS && _isArray(process.env.DELAY_BETWEEN_REQUESTS) ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS) : [1, 5],
  DELAY_START_BOT: process.env.DELAY_START_BOT && _isArray(process.env.DELAY_START_BOT) ? JSON.parse(process.env.DELAY_START_BOT) : [1, 15],
};

module.exports = settings;
