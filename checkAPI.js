const { log } = require("./utils"); // Adjust the path as necessary
const settings = require("./config/config");

const apiData = {
  "clayton": "https://tonclayton.fun/api/aT83M535-617h-5deb-a17b-6a335a67ffd5",
  "pineye": "https://api2.pineye.io/api",
  "memex": "https://memex-preorder.memecore.com",
  "pocketfi": "https://bot.pocketfi.org",
  "kat": "https://apiii.katknight.io/api",
  "pinai": "https://prod-api.pinai.tech",
  "hivera": "https://app.hivera.org",
  "midas": "https://api-tg-app.midas.app/api",
  "animix": "https://pro-api.animix.tech",
  "puparty": "https://tg-puparty-h5-api.puparty.com/api",
  "meshchain": "https://api.meshchain.ai/meshmain",
  "wizzwoods": "https://game-api.wizzwoods.com/api/v1",
  "uxuy": "https://miniapp.uxuy.one/rpc",
  "sleep": "https://tgapi.sleepagotchi.com/v1/tg","copyright": "If the api changes, please contact the Airdrop Hunter Siêu Tố tele team (https://t.me/AirdropScript6) for more information and updates!| Have any issues, please contact: https://t.me/AirdropScript6"
};

async function checkBaseUrl() {
  console.log("Checking api...".blue);

  if (settings.ADVANCED_ANTI_DETECTION) {
    const result = await getBaseApi();
    if (result.endpoint) {
      log("No change in api!", "success");
      return result;
    }
  } else {
    return settings.BASE_URL;
  }
}

async function getBaseApi() {
  try {
    // data of fetching from a URL
    if (apiData.pineye) {
      return { endpoint: apiData.pineye, message: apiData.copyright };
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
}

module.exports = { checkBaseUrl };