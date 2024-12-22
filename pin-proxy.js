const fs = require("fs");
const path = require("path");
const axios = require("axios");
const readline = require("readline");
const colors = require("colors");
const { HttpsProxyAgent } = require("https-proxy-agent");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { sleep, loadData, getRandomNumber, updateEnv } = require("./utils");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { checkBaseUrl } = require("./checkAPI");

class PinEye {
  constructor(queryId, accountIndex, proxy, baseURL) {
    this.queryId = queryId;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.proxyIP = null;
    this.baseURL = baseURL;
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

    this.log(`Tạo user agent...`);
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
    this.headers["sec-ch-ua"] = `Not)A;Brand";v="99", "${platform} WebView";v="127", "Chromium";v="127"`;
    this.headers["sec-ch-ua-platform"] = platform;
    this.headers["User-Agent"] = this.#get_user_agent();
  }

  createUserAgent() {
    try {
      const telegramauth = this.queryId;
      const userData = JSON.parse(decodeURIComponent(telegramauth.split("user=")[1].split("&")[0]));
      this.session_name = userData.id;
      this.#get_user_agent();
    } catch (error) {
      // console.error("URI Error:", error.message);
      this.log(`Không để decode query_id, vui lòng lấy lại query id`, "warning");
    }
  }

  customHeaders(token = "") {
    const headers = this.headers;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  getAxiosConfig(token = "", proxy = this.proxy) {
    const config = {
      headers: this.customHeaders(token),
      timeout: 15000,
    };
    if (proxy) {
      const proxyAgent = new HttpsProxyAgent(proxy);
      config.httpsAgent = proxyAgent;
    }
    return config;
  }

  async checkProxyIP(proxy) {
    try {
      const proxyAgent = new HttpsProxyAgent(proxy);
      const response = await axios.get(`https://api.ipify.org?format=json`, { httpsAgent: proxyAgent });
      if (response.status === 200) {
        return response.data.ip;
      } else {
        throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
    }
  }

  async auth(userinfo, proxy) {
    const url = `${settings.BASE_URL}/v2/Login`;

    const payload = { userinfo };

    try {
      const response = await axios.post(url, payload, this.getAxiosConfig("", proxy));
      return response.data;
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
      return null;
    }
  }

  async getProfile(token, proxy) {
    const url = `${this.baseURL}/v3/Profile/GetBalance`;

    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      return response.data;
    } catch (error) {
      this.log(`Error: ${error.message}`, "error");
      return null;
    }
  }

  async getBoosters(token, proxy) {
    const url = `${this.baseURL}/v1/Booster`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      return response.data;
    } catch (error) {
      this.log(`Lỗi rồi: ${error.message}`, "error");
      return null;
    }
  }

  async buyBooster(token, boosterId, proxy) {
    const url = `${this.baseURL}/v3/Profile/BuyBooster?boosterId=${boosterId}`;
    try {
      const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
      return response.data;
    } catch (error) {
      this.log(`Không thể nâng cấp ${boosterId}: ${error.message}`, "error");
      return null;
    }
  }

  async manageBoosters(token, balance, proxy) {
    const boostersData = await this.getBoosters(token, proxy);
    if (!boostersData || !boostersData.data) {
      this.log("Không lấy được dữ liệu boosts!", "error");
      return;
    }

    for (const booster of boostersData.data) {
      while (balance >= booster.cost) {
        await sleep(3);
        const result = await this.buyBooster(token, booster.id, proxy);
        if (result && !result.errors) {
          this.log(`Nâng cấp ${booster.title} thành công. Balance còn: ${result.data.balance}`, "success");
          balance = result.data.balance;
        } else {
          this.log(`Không thể mua ${booster.title}.`, "warning");
          break;
        }
      }
    }
  }

  async tapEnergy(token, energy, proxy) {
    const url = `${this.baseURL}/v1/Tap?count=${energy}`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      if (response.data && !response.data.errors) {
        this.log(`Tap thành công | Balance: ${response.data.data.balance}`, "custom");
      }
    } catch (error) {
      this.log(`Không thể tap: ${error.message}`, "error");
    }
  }

  async dailyReward(token, proxy) {
    const url = `${this.baseURL}/v1/DailyReward`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      if (response.data && response.data.data && response.data.data.canClaim) {
        const claimUrl = `${this.baseURL}/v1/DailyReward/claim`;
        const claimResponse = await axios.post(claimUrl, {}, this.getAxiosConfig(token, proxy));
        if (claimResponse.data && !claimResponse.data.errors) {
          this.log(`Điểm danh thành công | Balance: ${claimResponse.data.data.balance}`, "success");
        }
      } else {
        this.log("Hôm nay bạn đã điểm danh rồi!", "warning");
      }
    } catch (error) {
      this.log(`Không lấy được thông tin điểm danh: ${error.message}`, "error");
    }
  }

  log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
      case "success":
        console.log(`[${timestamp}][Account ${this.accountIndex + 1}][${this.proxyIP}] [*] ${msg}`.green);
        break;
      case "custom":
        console.log(`[${timestamp}][Account ${this.accountIndex + 1}][${this.proxyIP}] [*] ${msg}`.magenta);
        break;
      case "error":
        console.log(`[${timestamp}][Account ${this.accountIndex + 1}][${this.proxyIP}] [!] ${msg}`.red);
        break;
      case "warning":
        console.log(`[${timestamp}][Account ${this.accountIndex + 1}][${this.proxyIP}] [*] ${msg}`.yellow);
        break;
      default:
        console.log(`[${timestamp}][Account ${this.accountIndex + 1}][${this.proxyIP}] [*] ${msg}`.blue);
    }
  }

  async Countdown(seconds) {
    for (let i = seconds; i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[${new Date().toLocaleTimeString()}] [*] Chờ ${i} giây để tiếp tục...`);
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
        this.log("Không lấy được firstname.", "warning");
        return "Unknown";
      }
    } catch (error) {
      this.log(`Không lấy được firstname: ${error.message}`, "error");
      return "Unknown";
    }
  }

  async checkAndBuyLottery(token, proxy) {
    const url = `${this.baseURL}/v1/Lottery`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      const { ticket } = response.data.data;
      if (!ticket.hasBuyed) {
        const buyTicketUrl = `${this.baseURL}/v1/Lottery/BuyTicket`;
        const buyResponse = await axios.post(buyTicketUrl, {}, this.getAxiosConfig(token, proxy));
        const { code, balance } = buyResponse.data.data;
        this.log(`Mua thành công vé số ${code} | Balance còn: ${balance}`, "custom");
      } else {
        this.log(`Bạn đã mua vé số rồi: ${ticket.code}`, "warning");
      }
    } catch (error) {
      this.log(`Không thể mua vé số: ${error.message}`, "error");
    }
  }

  async getSocialTasks(token, proxy) {
    const url = `${this.baseURL}/v1/Social`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));

      return response.data.data.map((task) => ({
        id: task.id,
        title: task.title,
        score: task.score,
        isClaimed: task.isClaimed,
      }));
    } catch (error) {
      this.log(`Không thể lấy danh sách nhiệm vụ xã hội: ${error.message}`, "error");
      return [];
    }
  }

  async claimSocialTask(token, task, proxy) {
    const { id, title } = task;

    const url = `${this.baseURL}/v1/SocialFollower/claim?socialId=${id}`;
    try {
      const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
      if (response.data && !response.data.errors) {
        this.log(`Làm nhiệm vụ thành công`, "success");
        return response.data.data;
      } else {
        if (error.status == 400) this.log(`Không thể hoàn thành nhiệm vụ ${id} | ${title} : cần làm tay hoặc chưa đủ điều kiện`, "warning");

        return null;
      }
    } catch (error) {
      if (error.status == 400) this.log(`Không thể hoàn thành nhiệm vụ ${id} | ${title} : cần làm tay hoặc chưa đủ điều kiện`, "warning");
      else this.log(`Lỗi không thể hoàn thành nhiệm vụ ${id} | ${title} : ${error.message}`, "error");

      return null;
    }
  }

  async getPranaGameMarketplace(token, proxy) {
    const url = `${this.baseURL}/v1/PranaGame/Marketplace`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      return response.data.data;
    } catch (error) {
      this.log(`Không thể lấy danh sách thẻ: ${error.message}`, "error");
      return null;
    }
  }

  async dailyCombo(token) {
    const url = `${this.baseURL}/v1/DailySecretCode/ClaimReward?code=${settings.DAILY_COMBO_CODE.trim()}`;
    try {
      const response = await axios.post(url, {}, this.getAxiosConfig(token, this.proxy));
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
      const response = await axios.get(url, this.getAxiosConfig(token, this.proxy));
      const canClaim = response.data.data.canClaim;
      if (canClaim) {
        this.log(`Completing dailycombo...`);
        await this.dailyCombo(token);
      } else {
        this.log(`Combo daily is completed today!`, "warning");
      }
      return response.data.data;
    } catch (error) {
      this.log(`Không thể handleDailyCombo: ${error.message}`, "error");
      return null;
    }
  }

  async getPratice(token, proxy) {
    const url = `${this.baseURL}/v1/PranaGame/GetAllPractices`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      return response.data.data;
    } catch (error) {
      this.log(`Không thể getPratice: ${error.message}`, "error");
      return null;
    }
  }
  async claimPratice(token, id, proxy) {
    const url = `${this.baseURL}/v1/PranaGame/ClaimPractice?practiceId=${id}`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      return response.data.data;
    } catch (error) {
      this.log(`Không thể claimPratice: ${error.message}`, "error");
      return null;
    }
  }

  isToday(timestamp) {
    if (!timestamp) return true;
    // Convert to milliseconds
    const dateFromTimestamp = new Date(timestamp * 1000);

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to the start of the day

    // Check if the date from timestamp is today
    return dateFromTimestamp.getTime() === today.getTime();
  }

  async handlePractice(token, proxy) {
    const data = await this.getPratice(token, proxy);
    const { practiceList: practices } = data;
    if (practices && practices?.length > 0) {
      const tasks = practices.filter((item) => this.isToday(item.nextPracticeTime));
      if (tasks?.length > 0) {
        for (const todayPractice of tasks) {
          await sleep(1);
          this.log(`Starting practice: ${todayPractice.title}...`);
          this.log(`Wating ${todayPractice.practiceTime} seconds to claim ${todayPractice.title}`);
          await sleep(todayPractice.practiceTime);
          const res = await this.claimPratice(token, todayPractice.id, proxy);
          if (res?.isClaimed) {
            this.log(`Claimed practice today| Rewards: ${res.profit}`, "success");
          }
        }
      } else {
        this.log(`You completed practice today!`, "warning");
      }
    }
    return;
  }

  async getQuets(token, proxy) {
    const url = `${this.baseURL}/v3/academies`;
    try {
      const response = await axios.get(url, this.getAxiosConfig(token, proxy));
      return response.data.data;
    } catch (error) {
      this.log(`Lỗi rồi: ${error.message}`, "error");
      return null;
    }
  }

  async claimQuest(token, questId, answerId, proxy) {
    const url = `${this.baseURL}/v3/academies/${questId}/claim?answerId=${answerId}`;
    try {
      const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
      return response.data;
    } catch (error) {
      this.log(`Không claim quest ${questId}: ${error.message}`, "error");
      return null;
    }
  }

  async handleQuest(token, proxy) {
    let quests = await this.getQuets(token, proxy);
    let answers = require("./quest.json");
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
        const res = await this.claimQuest(token, quest.id, answer.answerId, proxy);
        if (res?.isCorrect) {
          this.log(`Quest ${quest.title} correct! | Answer: ${answer.answer} | Reward: ${res.reward}`, "success");
        } else {
          this.log(`Quest ${quest.title} incorrect! | Wrong answer: ${answer.answer}`, "warning");
        }
      }
    }
  }

  async purchasePranaGameCard(token, card, proxy) {
    const { id, currentLevel, title, cooldownEndTimestamp, cooldownTime } = card;

    if (cooldownTime > 0) {
      const now = Math.floor(Date.now());
      const secondsLeft = cooldownEndTimestamp - now;
      if (secondsLeft > 0) {
        const hours = Math.floor(secondsLeft / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;
        this.log(`Chưa đến thời gian nâng cấp tiếp theo cho thẻ ${title}: Còn ${hours} hours ${minutes} minutes ${seconds} seconds to continue upgrade...`, "warning");
        return;
      }
    }

    const url = `${this.baseURL}/v1/PranaGame/Purch?cardId=${id}&level=${currentLevel + 1}`;
    try {
      const response = await axios.post(url, {}, this.getAxiosConfig(token, proxy));
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async managePranaGameCards(token, balance, proxy) {
    const marketplaceData = await this.getPranaGameMarketplace(token, proxy);
    if (!marketplaceData) return;

    let maxCost = settings.MAX_COST_UPGRADE;

    let allCards = [];
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
        const purchaseResult = await this.purchasePranaGameCard(token, card, proxy);
        if (purchaseResult && purchaseResult.data && purchaseResult.data.isSuccess) {
          balance = purchaseResult.data.balance;
          this.log(`Nâng cấp "${card.title}" thành công | Profit: ${card.profit} | Balance còn: ${balance}`, "success");
        }
      }
    }
  }

  async runAccount() {
    const hoiturbo = settings.AUTO_UPGRADE_BOOSTER;
    const hoiveso = settings.AUTO_BUY_LOTTERY;
    const hoiPranaCards = settings.AUTO_UPGRADE;
    const proxy = this.proxy;

    let proxyIP = "Unknown";
    try {
      proxyIP = await this.checkProxyIP(proxy);
      this.proxyIP = proxyIP;
    } catch (error) {
      this.log(`Proxy lỗi: ${error.message}`, "error");
      return;
    }
    const i = this.accountIndex;
    const userinfo = this.queryId;
    const userData = JSON.parse(decodeURIComponent(userinfo.split("user=")[1].split("&")[0]));
    const userId = userData.id;
    const firstName = userData.first_name || "";
    const lastName = userData.last_name || "";
    this.session_name = userId;
    const timesleep = getRandomNumber(settings.DELAY_START_BOT[0], settings.DELAY_START_BOT[1]);
    console.log(`========== Tài khoản ${i + 1} | ${firstName + " " + lastName} | ip: ${proxyIP} | Bắt đầu sau ${timesleep} giây...==========`.magenta);
    this.set_headers();
    await sleep(timesleep);

    try {
      this.log(`Đang đăng nhập...`, "info");
      const apiResponse = await this.auth(userinfo, proxy);
      if (apiResponse && apiResponse.data && apiResponse.data.token) {
        const token = apiResponse.data.token;
        const profileResponse = await this.getProfile(token, proxy);
        if (profileResponse && profileResponse.data) {
          let { totalBalance, level, earnPerTap } = profileResponse.data.profile;
          const { maxEnergy, currentEnergy } = profileResponse.data.energy;

          this.log(`Balance: ${totalBalance}`, "success");
          this.log(`Lv: ${level}`, "success");
          this.log(`Earn Per Tap: ${earnPerTap}`, "success");
          this.log(`Năng lượng: ${currentEnergy} / ${maxEnergy}`, "success");

          if (currentEnergy > 0) {
            await this.tapEnergy(token, currentEnergy, proxy);
            const updatedProfile = await this.getProfile(token, proxy);
            if (updatedProfile && updatedProfile.data) {
              totalBalance = updatedProfile.data.profile.totalBalance;
            }
          }

          await this.dailyReward(token, proxy);

          if (settings.AUTO_PRACTICE) {
            await this.handlePractice(token, proxy);
          }
          if (settings.DAILY_COMBO) {
            await this.handleDailyCombo(token);
          }
          if (hoiturbo) {
            await this.manageBoosters(token, totalBalance, proxy);
          }

          if (settings.AUTO_QUEST) {
            await this.handleQuest(token, proxy);
          }

          if (hoiPranaCards) {
            await this.managePranaGameCards(token, totalBalance, proxy);
          }

          if (settings.AUTO_TASK) {
            const socialTasks = await this.getSocialTasks(token, proxy);
            const unclaimedTasks = socialTasks.filter((task) => !task.isClaimed && !settings.SKIP_TASKS.includes(task.id));
            for (const task of unclaimedTasks) {
              await sleep(3);
              this.log(`Nhận thưởng cho nhiệm vụ "${task.title}" (${task.score} điểm)`, "info");
              await this.claimSocialTask(token, task, proxy);
            }
          }
        } else {
          this.log(`Không lấy được dữ liệu: ${profileResponse ? profileResponse.errors : "No response data"}`, "error");
        }
      } else {
        this.log(`Đăng nhập thất bại: ${apiResponse ? apiResponse.errors : "No response data"}`, "error");
      }
    } catch (error) {
      this.log(`Lỗi khi xử lý tài khoản: ${error.message}`, "error");
      return;
    }
  }
}

async function runWorker(workerData) {
  const { queryId, accountIndex, proxy, baseURL } = workerData;
  const to = new PinEye(queryId, accountIndex, proxy, baseURL);
  try {
    await Promise.race([to.runAccount(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 24 * 60 * 60 * 1000))]);
    parentPort.postMessage({
      accountIndex,
    });
  } catch (error) {
    parentPort.postMessage({ accountIndex, error: error.message });
  } finally {
    parentPort.postMessage("taskComplete");
  }
}

async function main() {
  const queryIds = loadData("data.txt");
  const proxies = loadData("proxy.txt");
  // const agents = #load_session_data();
  // const wallets = loadData("wallets.txt");
  const { endpoint: baseURL, message } = await checkBaseUrl();
  console.log(`${message}`.yellow);
  // console.log(`${baseURL}`);
  if (!baseURL) return console.log(`Không thể tìm thấy ID API, thử lại sau!`.red);
  // process.exit(0);
  if (queryIds.length > proxies.length) {
    console.log("Số lượng proxy và data phải bằng nhau.".red);
    console.log(`Data: ${queryIds.length}`);
    console.log(`Proxy: ${proxies.length}`);
    process.exit(1);
  }
  console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
  let maxThreads = settings.MAX_THEADS;

  queryIds.map((val, i) => new PinEye(val, i, proxies[i]).createUserAgent(), baseURL);

  await sleep(1);
  while (true) {
    let currentIndex = 0;
    const errors = [];

    while (currentIndex < queryIds.length) {
      const workerPromises = [];
      const batchSize = Math.min(maxThreads, queryIds.length - currentIndex);
      for (let i = 0; i < batchSize; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            baseURL,
            queryId: queryIds[currentIndex],
            accountIndex: currentIndex,
            proxy: proxies[currentIndex % proxies.length],
          },
        });

        workerPromises.push(
          new Promise((resolve) => {
            worker.on("message", (message) => {
              if (message === "taskComplete") {
                worker.terminate();
              }
              if (message.error) {
                errors.push(`Tài khoản ${message.accountIndex}: ${message.error}`);
              }
              resolve();
            });
            worker.on("error", (error) => {
              console.log(`Lỗi worker cho tài khoản ${currentIndex + 1}: ${error.message}`);
              worker.terminate();
            });
            worker.on("exit", (code) => {
              errors.push(`Worker cho tài khoản ${currentIndex + 1} thoát với mã: ${code}`);
              worker.terminate();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (errors.length > 0) {
        errors.length = 0;
      }

      if (currentIndex < queryIds.length) {
        await sleep(3);
      }
    }
    const to = new PinEye(null, 0, proxies[0], baseURL);
    await sleep(3);
    console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
    console.log(`=============Hoàn thành tất cả tài khoản=============`.magenta);
    await to.Countdown(settings.TIME_SLEEP * 60);
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.log("Lỗi rồi:", error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}
