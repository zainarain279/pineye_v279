const fs = require("fs");
const path = require("path");
const axios = require("axios");
const readline = require("readline");
const colors = require("colors");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { sleep, updateEnv } = require("./utils");
const { checkBaseUrl } = require("./checkAPI");

class PinEye {
  constructor() {
    this.baseURL = settings.BASE_URL;
    this.session_name = null;
    this.session_user_agents = this.#load_session_data();
    this.skipTasks = settings.SKIP_TASKS;
    this.headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
      "Content-Type": "application/json",
      Origin: "https://app.pineye.io",
      Referer: "https://app.pineye.io/",
      chatid: this.session_name,
      "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    };
  }

  customHeaders(token = "") {
    const headers = this.headers;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // this.wallets = this.loadWallets();

  #load_session_data() {
    try {
      const filePath = path.join(process.cwd(), "session_user_agents.json");
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      } else {
        throw error;
      }
    }
  }

  #get_random_user_agent() {
    const randomIndex = Math.floor(Math.random() * user_agents.length);
    return user_agents[randomIndex];
  }

  #get_user_agent() {
    if (this.session_user_agents[this.session_name]) {
      return this.session_user_agents[this.session_name];
    }

    this.log(`Create user agent...`);
    const newUserAgent = this.#get_random_user_agent();
    this.session_user_agents[this.session_name] = newUserAgent;
    this.#save_session_data(this.session_user_agents);
    return newUserAgent;
  }

  #save_session_data(session_user_agents) {
    const filePath = path.join(process.cwd(), "session_user_agents.json");
    fs.writeFileSync(filePath, JSON.stringify(session_user_agents, null, 2));
  }

  #get_platform(userAgent) {
    const platformPatterns = [
      { pattern: /iPhone/i, platform: "ios" },
      { pattern: /Android/i, platform: "android" },
      { pattern: /iPad/i, platform: "ios" },
    ];

    for (const { pattern, platform } of platformPatterns) {
      if (pattern.test(userAgent)) {
        return platform;
      }
    }

    return "Unknown";
  }

  set_headers() {
    const platform = this.#get_platform(this.#get_user_agent());
    this.headers["sec-ch-ua"] = `"Not)A;Brand";v="99", "${platform} WebView";v="127", "Chromium";v="127`;
    this.headers["sec-ch-ua-platform"] = platform;
    this.headers["User-Agent"] = this.#get_user_agent();
  }

  async auth(userinfo) {
    const url = `${settings.BASE_URL}/v2/Login`;
    const payload = { userinfo };
    try {
      const response = await axios.post(url, payload, {
        headers: {
          ...this.customHeaders(),
        },
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      this.log(`Error auth: ${error.message}`, "error");
      return null;
    }
  }

  async getProfile(token) {
    const url = `${this.baseURL}/v3/Profile/GetBalance`;

    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.log(`Error getProfile: ${error.message}`, "error");
      return null;
    }
  }

  async getReward(token) {
    const url = `${this.baseURL}/v3/Christmas/GetReward`;
    const urlCheck = `${this.baseURL}/v3/Christmas/Get`;

    try {
      const response = await axios.get(urlCheck, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      if (response?.data?.data?.canGetReward) {
        const responseRw = await axios.post(url, null, {
          headers: this.customHeaders(token),
          timeout: 10000,
        });
        if (responseRw?.data?.data?.reward) {
          this.log(`Claim reward Christmas success | Reward ${responseRw?.data?.data?.reward}`, "success");
        }
      }
      return response.data;
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
      return null;
    }
  }

  async getBoosters(token) {
    const url = `${this.baseURL}/v1/Booster`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
      return null;
    }
  }

  async getQuets(token) {
    const url = `${this.baseURL}/v3/academies`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data.data;
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
      return null;
    }
  }

  async claimQuest(token, questId, answerId) {
    const url = `${this.baseURL}/v3/academies/${questId}/claim?answerId=${answerId}`;
    try {
      const response = await axios.post(url, null, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.log(`Cannot claim quest ${questId}: ${error.message}`, "error");
      return null;
    }
  }

  async buyBooster(token, boosterId) {
    const url = `${this.baseURL}/v3/Profile/BuyBooster?boosterId=${boosterId}`;
    try {
      const response = await axios.post(
        url,
        {},
        {
          headers: this.customHeaders(token),
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      this.log(`Cannot upgrade ${boosterId}: ${error.message}`, "error");
      return null;
    }
  }

  async manageBoosters(token, balance) {
    const boostersData = await this.getBoosters(token);
    if (!boostersData || !boostersData.data) {
      this.log("Unable to get data boosts!", "error");
      return;
    }

    for (const booster of boostersData.data) {
      while (balance >= booster.cost) {
        await sleep(2);

        const result = await this.buyBooster(token, booster.id);
        if (result && !result.errors) {
          this.log(`Upgrade ${booster.title} success. Balance also: ${result.data.balance}`, "success");
          balance = result.data.balance;
        } else {
          this.log(`Cannot buy ${booster.title}.`, "warning");
          break;
        }
      }
    }
  }

  async tapEnergy(token, energy) {
    const url = `${this.baseURL}/v1/Tap?count=${energy}`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      if (response.data && !response.data.errors) {
        this.log(`Tap success | Balance: ${response.data.data.balance}`, "custom");
      }
    } catch (error) {
      this.log(`Cannot tap: ${error.message}`, "error");
    }
  }

  async dailyReward(token) {
    const url = `${this.baseURL}/v1/DailyReward`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      if (response.data && response.data.data && response.data.data.canClaim) {
        const claimUrl = `${this.baseURL}/v1/DailyReward/claim`;
        const claimResponse = await axios.post(
          claimUrl,
          {},
          {
            headers: this.customHeaders(token),
            timeout: 10000,
          }
        );
        if (claimResponse.data && !claimResponse.data.errors) {
          this.log(`Roll call successful | Balance: ${claimResponse.data.data.balance}`, "success");
        }
      } else {
        this.log("You have checked in today.!", "warning");
      }
    } catch (error) {
      this.log(`Unable to get attendance information: ${error.message}`, "error");
    }
  }

  log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
      case "success":
        console.log(`[${timestamp}] [*] ${msg}`.green);
        break;
      case "custom":
        console.log(`[${timestamp}] [*] ${msg}`.magenta);
        break;
      case "error":
        console.log(`[${timestamp}] [!] ${msg}`.red);
        break;
      case "warning":
        console.log(`[${timestamp}] [*] ${msg}`.yellow);
        break;
      default:
        console.log(`[${timestamp}] [*] ${msg}`.blue);
    }
  }

  async Countdown(seconds) {
    for (let i = seconds; i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[${new Date().toLocaleTimeString()}] [*] Wait ${i} seconds to continue...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("");
  }

  extractFirstName(userinfo) {
    try {
      const decodedData = decodeURIComponent(userinfo);

      const userMatch = decodedData.match(/user=({.*?})/);
      if (userMatch && userMatch[1]) {
        const userObject = JSON.parse(userMatch[1]);

        return userObject.first_name;
      } else {
        this.log("Cannot get firstname.", "warning");
        return "Unknown";
      }
    } catch (error) {
      this.log(`Cannot get firstname: ${error.message}`, "error");
      return "Unknown";
    }
  }

  async checkAndBuyLottery(token) {
    const url = `${this.baseURL}/v1/Lottery`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      const { ticket } = response.data.data;
      if (!ticket.hasBuyed) {
        const buyTicketUrl = `${this.baseURL}/v1/Lottery/BuyTicket`;
        const buyResponse = await axios.post(
          buyTicketUrl,
          {},
          {
            headers: this.customHeaders(token),
            timeout: 10000,
          }
        );
        const { code, balance } = buyResponse.data.data;
        this.log(`Successfully purchased lottery tickets ${code} | Balance still: ${balance}`, "custom");
      } else {
        this.log(`You have bought a lottery ticket: ${ticket.code}`, "warning");
      }
    } catch (error) {
      this.log(`Can't buy lottery tickets: ${error.message}`, "error");
    }
  }

  async getSocialTasks(token) {
    const url = `${this.baseURL}/v1/Social`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });

      return response.data.data.map((task) => ({
        id: task.id,
        title: task.title,
        score: task.score,
        isClaimed: task.isClaimed,
      }));
    } catch (error) {
      this.log(`Unable to get social task list: ${error.message}`, "error");
      return [];
    }
  }

  async claimSocialTask(token, task) {
    const { id, title } = task;
    const url = `${this.baseURL}/v1/SocialFollower/claim?socialId=${id}`;
    try {
      const response = await axios.post(
        url,
        {},
        {
          headers: this.customHeaders(token),
          timeout: 10000,
        }
      );
      if (response.data && !response.data.errors) {
        this.log(`Mission successful`, "success");
        return response.data.data;
      } else {
        this.log(`Unable to complete the task ${id} | ${title} : need to do by hand or not qualified`, "warning");
        return null;
      }
    } catch (error) {
      if (error.status == 400) this.log(`Unable to complete the task ${id} | ${title} : need to do by hand or not qualified`, "warning");
      else this.log(`Error: Unable to complete the task ${id} | ${title} : ${error.message}`, "error");
      return null;
    }
  }

  async getPranaGameMarketplace(token) {
    const url = `${this.baseURL}/v1/PranaGame/Marketplace`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data.data;
    } catch (error) {
      this.log(`Unable to get card list: ${error.message}`, "error");
      return null;
    }
  }

  async dailyCombo(token) {
    const url = `${this.baseURL}/v1/DailySecretCode/ClaimReward?code=${settings.DAILY_COMBO_CODE.trim()}`;
    try {
      const response = await axios.post(
        url,
        {},
        {
          headers: this.customHeaders(token),
          timeout: 10000,
        }
      );
      if (response.data.data) {
        this.log(`Dailycombo completed successfully!`, "success");
      }
      return response.data.data;
    } catch (error) {
      if (error.status === 400) {
        this.log(`Wrong secrect code dailycombo!`, "warning");
      } else this.log(`Không thể dailyCombo: ${error.message}`, "error");
      return null;
    }
  }
  async handleDailyCombo(token) {
    const url = `${this.baseURL}/v1/DailySecretCode/CanClaimReward`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      const canClaim = response.data.data.canClaim;
      if (canClaim) {
        this.log(`Completing dailycombo...`);
        await this.dailyCombo(token);
      } else {
        this.log(`Combo daily is completed today!`, "warning");
      }
      return response.data.data;
    } catch (error) {
      this.log(`Cannot handle DailyCombo: ${error.message}`, "error");
      return null;
    }
  }

  async getPratices(token) {
    const url = `${this.baseURL}/v1/PranaGame/GetAllPractices`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data.data;
    } catch (error) {
      this.log(`Cannot get Practice: ${error.message}`, "error");
      return null;
    }
  }

  // async getPraticeDetail(token, id) {
  //   const url = `${this.baseURL}/v1/PranaGame/GetPracticeDetails?practiceId=${id}`;
  //   try {
  //     const response = await axios.get(url, {
  //       headers: this.customHeaders(token),
  //       timeout: 10000,
  //     });
  //     return response.data.data;
  //   } catch (error) {
  //     this.log(`Không thể get Pratice: ${error.message}`, "error");
  //     return null;
  //   }
  // }

  async claimPratice(token, id) {
    const url = `${this.baseURL}/v1/PranaGame/ClaimPractice?practiceId=${id}`;
    try {
      const response = await axios.get(url, {
        headers: this.customHeaders(token),
        timeout: 10000,
      });
      return response.data.data;
    } catch (error) {
      this.log(`Cannot claim Practice: ${error.message}`, "error");
      return null;
    }
  }

  isToday(timestamp) {
    if (!timestamp) return true;
    // Convert to milliseconds
    const dateFromTimestamp = new Date(timestamp * 1000);
    dateFromTimestamp.setHours(0, 0, 0, 0);
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to the start of the day

    return dateFromTimestamp.getTime() === today.getTime();
  }

  async handlePractice(token) {
    const data = await this.getPratices(token);
    const { practiceList: practices } = data;
    if (practices && practices?.length > 0) {
      const tasks = practices.filter((item) => this.isToday(item.nextPracticeTime));
      if (tasks?.length > 0) {
        for (const todayPractice of tasks) {
          await sleep(1);
          this.log(`Starting practice: ${todayPractice.title}...`);
          this.log(`Wating ${todayPractice.practiceTime} seconds to claim ${todayPractice.title}`);
          await sleep(todayPractice.practiceTime);
          const res = await this.claimPratice(token, todayPractice.id);
          if (res?.isClaimed) {
            this.log(`Claimed practice today| Rewards: ${res.profit}`, "success");
          }
        }
      }
    }
    return;
  }

  async handleQuest(token) {
    let quests = await this.getQuets(token);
    let answers = require("./answer.json");
    quests = quests.filter((q) => !q.isClaimed);
    answers = answers.filter((a) => a.answer);
    if (quests.length === 0 || answers.length == 0) {
      return this.log(`No quests available`, "warning");
    }

    for (const quest of quests) {
      const answer = answers.find((an) => (an.answer && an?.id == quest.id) || quest.title.includes(an.title) || quest.question.title.includes(an.quest));
      if (answer) {
        await sleep(3);
        this.log(`Quest ${quest.title} completing...`);
        const res = await this.claimQuest(token, quest.id, answer.answerId);
        if (res?.data?.isCorrect) {
          this.log(`Quest ${quest.title} correct! | Answer: ${answer.answer} | Reward: ${res?.data?.reward}`, "success");
        } else {
          this.log(`Quest ${quest.title} incorrect! | Wrong answer: ${answer.answer}`, "warning");
        }
      }
    }
  }

  async purchasePranaGameCard(token, card) {
    const { id, currentLevel, title, cooldownEndTimestamp, cooldownTime } = card;

    if (cooldownTime > 0) {
      const now = Math.floor(Date.now());
      const secondsLeft = cooldownEndTimestamp - now;
      if (secondsLeft > 0) {
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;
        this.log(`It is not time for the next card upgrade yet. ${title}: Still ${hours} hours ${minutes} minutes ${seconds} seconds to continue upgrade...`, "warning");
        return;
      }
    }

    const url = `${this.baseURL}/v1/PranaGame/Purch?cardId=${id}&level=${currentLevel + 1}`;
    try {
      const response = await axios.post(
        url,
        {},
        {
          headers: this.customHeaders(token),
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async managePranaGameCards(token, balance) {
    const marketplaceData = await this.getPranaGameMarketplace(token);
    if (!marketplaceData) return;

    let maxCost = settings.MAX_COST_UPGRADE;
    let allCards = [];

    // console.log(marketplaceData);
    for (const category of marketplaceData.categories) {
      for (const card of category.cards) {
        allCards.push({
          ...card,
          categoryId: category.id,
        });
      }
    }

    allCards.sort((a, b) => b.profit - a.profit).filter((card) => card.currentLevel < card.maxLevel && !card.isCompleted);

    for (const card of allCards) {
      if (balance >= card.cost && card.cost <= maxCost && !card.isCompleted) {
        await sleep(2);
        const purchaseResult = await this.purchasePranaGameCard(token, card);
        if (purchaseResult && purchaseResult.data && purchaseResult.data.isSuccess) {
          balance = purchaseResult.data.balance;
          this.log(`Upgraded card "${card.title}" successfully | Profit: ${card.profit} | Balance remaining: ${balance}`, "success");
        }
      }
    }
  }

async main() {
    console.log(`
\x1b[33m░▀▀█░█▀█░▀█▀░█▀█
░▄▀░░█▀█░░█░░█░█
░▀▀▀░▀░▀░▀▀▀░▀░▀
╔══════════════════════════════════╗
║                                  ║
║  ZAIN ARAIN                      ║
║  AUTO SCRIPT MASTER              ║
║                                  ║
║  JOIN TELEGRAM CHANNEL NOW!      ║
║  https://t.me/AirdropScript6     ║
║  @AirdropScript6 - OFFICIAL      ║
║  CHANNEL                         ║
║                                  ║
║  FAST - RELIABLE - SECURE        ║
║  SCRIPTS EXPERT                  ║
║                                  ║
╚══════════════════════════════════╝
\x1b[0m
    `);

    console.log(colors.yellow("Tool developed by tele group Airdrop Hunter Super Speed (https://t.me/AirdropScript6)"));

    const dataFile = path.join(__dirname, "data.txt");
    const data = fs.readFileSync(dataFile, "utf8").replace(/\r/g, "").split("\n").filter(Boolean);

    const hoiturbo = settings.AUTO_UPGRADE_BOOSTER;
    const hoiveso = settings.AUTO_BUY_LOTTERY;
    const hoiPranaCards = settings.AUTO_UPGRADE;

    const { endpoint: baseURL, message } = await checkBaseUrl();
    console.log(`${message}`.yellow);
    if (!baseURL) return console.log(`API ID not found, try again later!`.red);
    this.baseURL = baseURL;
    // process.exit(0);

    while (true) {
      for (let i = 0; i < data.length; i++) {
        const userinfo = data[i];
        const userData = JSON.parse(decodeURIComponent(userinfo.split("user=")[1].split("&")[0]));
        const userId = userData.id;
        const firstName = userData.first_name || "";
        const lastName = userData.last_name || "";
        this.session_name = userId;
        this.headers["chatid"] = userId;

        console.log(`========== Account ${i + 1}/${data.length} | ${firstName + " " + lastName} ==========`.magenta);
        this.set_headers();

        const apiResponse = await this.auth(userinfo);
        if (apiResponse && apiResponse.data && apiResponse.data.token) {
          const token = apiResponse.data.token;
          const profileResponse = await this.getProfile(token);
          if (profileResponse && profileResponse.data) {
            let { totalBalance, level, earnPerTap } = profileResponse.data.profile;
            const { maxEnergy, currentEnergy } = profileResponse.data.energy;

            this.log(`Balance: ${totalBalance}`, "success");
            this.log(`Lv: ${level}`, "success");
            this.log(`Earn Per Tap: ${earnPerTap}`, "success");
            this.log(`Energy: ${currentEnergy} / ${maxEnergy}`, "success");

            if (currentEnergy > 0) {
              await this.tapEnergy(token, currentEnergy);
              const updatedProfile = await this.getProfile(token);
              if (updatedProfile && updatedProfile.data) {
                totalBalance = updatedProfile.data.profile.totalBalance;
              }
            }

            if (settings.AUTO_CLAIM_CHRISTMAS) {
              await this.getReward(token);
            }

            await this.dailyReward(token);

            if (settings.AUTO_PRACTICE) {
              await this.handlePractice(token);
            }

            if (settings.DAILY_COMBO) {
              await this.handleDailyCombo(token);
            }
            if (hoiturbo) {
              await this.manageBoosters(token, totalBalance);
            }

            if (settings.AUTO_QUEST) {
              await this.handleQuest(token);
            }

            if (hoiPranaCards) {
              await this.managePranaGameCards(token, totalBalance);
            }

            if (settings.AUTO_TASK) {
              const socialTasks = await this.getSocialTasks(token);
              const unclaimedTasks = socialTasks.filter((task) => !task.isClaimed && !settings.SKIP_TASKS.includes(task.id));
              for (const task of unclaimedTasks) {
                await sleep(2);
                this.log(`Get rewards for missions "${task.title}" (${task.score} point)`, "info");
                await this.claimSocialTask(token, task);
              }
            }
          } else {
            this.log(`Unable to get data: ${profileResponse ? profileResponse.errors : "No response data"}`, "error");
          }
        } else {
          this.log(`Login failed: ${apiResponse ? apiResponse.errors : "No response data"}`, "error");
        }
      }
      await this.Countdown(settings.TIME_SLEEP * 60);
    }
  }
}

if (require.main === module) {
  const pineye = new PinEye();
  pineye.main().catch((err) => {
    console.error(err.toString().red);
    process.exit(1);
  });
}
